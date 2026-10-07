import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import goofyGifs from "../static/gifs/goofygen.json";
import { useToast } from "./Toast";
import { errorMessage } from "../lib/utils";
import { QUICK_CHAT } from "../lib/quickChat";

type ChatProps = {
  gameId: Id<"games">;
  userToken: string;
};

export function Chat({ gameId, userToken }: ChatProps) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<"quick" | "gif" | null>(null);
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

  const handleQuick = async (msg: string) => {
    setPanel(null);
    try {
      await sendMessage({ token: userToken, gameId, text: msg });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const handleGif = async (url: string) => {
    setPanel(null);
    try {
      await sendMessage({ token: userToken, gameId, gifUrl: url });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="chat-panel relative flex flex-col glass min-h-0 rounded-none border-x-0 border-b-0">
      <div className="px-4 py-2.5 shrink-0 border-b border-border text-sm text-zinc-300 font-semibold">
        Chat
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-8">Quiet crowd. Say something.</p>
        )}
        {messages.map((m) => (
          <div key={m._id} className="text-sm">
            <span className="font-medium text-zinc-400">{m.sender}:</span>{" "}
            {m.text && <span className="text-zinc-200 break-words">{m.text}</span>}
            {m.gifUrl && (
              <img src={m.gifUrl} alt="GIF" loading="lazy" className="rounded-lg mt-1 max-w-[140px]" />
            )}
          </div>
        ))}
      </div>

      <div className="relative p-2 sm:p-3 shrink-0 border-t border-border flex gap-2">
        {panel && (
          <div className="absolute inset-x-0 bottom-full z-20 flex flex-col max-h-[40dvh] h-28 sm:h-40 border-t border-border bg-zinc-900">
            <div className="flex gap-1 p-2 pb-0 shrink-0">
              {(["quick", "gif"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPanel(tab)}
                  className={`px-3 h-8 rounded-lg text-sm font-medium transition-colors ${panel === tab ? "bg-secondary text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  {tab === "quick" ? "Quick chat" : "GIFs"}
                </button>
              ))}
            </div>
            {panel === "quick" ? (
              <div className="flex-1 min-h-0 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1 content-start">
                {QUICK_CHAT.map((msg) => (
                  <button
                    key={msg}
                    type="button"
                    onClick={() => void handleQuick(msg)}
                    className="min-h-10 px-3 py-1.5 rounded-lg bg-secondary hover:bg-zinc-700 text-left text-sm text-zinc-200 transition-colors"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto p-2 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-1 content-start">
                {goofyGifs.map((g) => (
                  <button key={g.id} type="button" onClick={() => handleGif(g.url)} className="p-0 border-0 bg-transparent">
                    <img
                      src={g.thumb}
                      alt={g.keywords.join(", ")}
                      loading="lazy"
                      className="w-full h-14 object-cover cursor-pointer hover:opacity-70 rounded"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          aria-label="Quick chat and GIFs"
          aria-expanded={panel !== null}
          onClick={() => setPanel(panel ? null : "quick")}
          className="w-10 h-10 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center rounded-lg bg-secondary hover:bg-zinc-700 text-zinc-300 hover:text-white transition text-lg font-medium"
        >
          +
        </button>
        <input
          className="flex-1 min-w-0 bg-transparent border border-input rounded-lg px-3 py-2 text-base sm:text-sm text-white placeholder:text-zinc-500 outline-none focus:border-ring transition-colors"
          placeholder="Message"
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
          className="w-10 h-10 sm:w-8 sm:h-8 shrink-0 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-white transition text-xs font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
}
