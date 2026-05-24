import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { assistCall, draftAppointment } from "@/lib/copilot.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anrufpilot – German Phone Call Copilot for Ausländer" },
      {
        name: "description",
        content:
          "Live German call translation, AI listening assistant and suggested replies. Stop fearing doctor, landlord and Behörde phone calls.",
      },
      { property: "og:title", content: "Anrufpilot – German Phone Call Copilot" },
      {
        property: "og:description",
        content: "Real-time subtitles, suggested replies and appointment helper for phone calls in Germany.",
      },
    ],
  }),
  component: Home,
});

const LANGS = ["English", "العربية", "Türkçe", "Українська", "Español", "Français", "Hindi", "中文", "Русский", "Polski"];

type CopilotOut = Awaited<ReturnType<typeof assistCall>>;

function Home() {
  const assist = useServerFn(assistCall);
  const draft = useServerFn(draftAppointment);

  const [lang, setLang] = useState("English");
  const [context, setContext] = useState("Calling my Hausarzt to book an appointment");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [result, setResult] = useState<CopilotOut | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  // Appointment helper
  const [reason, setReason] = useState("Sehkontrolle beim Augenarzt");
  const [times, setTimes] = useState("Weekdays after 16:00 or Saturday morning");
  const [script, setScript] = useState<{ germanScript: string; translation: string } | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);

  const recRef = useRef<any>(null);
  const speechSupported = useMemo(
    () => typeof window !== "undefined" && !!(window as any).webkitSpeechRecognition,
    [],
  );

  async function runAssist(germanText: string) {
    if (!germanText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await assist({ data: { germanText, targetLang: lang, context } });
      setResult(r);
    } catch (e: any) {
      setError(e?.message ?? "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }

  function startListening() {
    if (!speechSupported) {
      setError("Live mic uses Chrome's webkitSpeechRecognition. Paste the German text manually instead.");
      return;
    }
    const SR = (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "de-DE";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t;
        else interimChunk += t;
      }
      if (finalChunk) {
        setTranscript((prev) => [...prev, finalChunk.trim()]);
        setInterim("");
        runAssist(finalChunk.trim());
      } else {
        setInterim(interimChunk);
      }
    };
    rec.onerror = (e: any) => setError(`Mic error: ${e.error}`);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  function speak(text: string) {
    if (typeof window === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  async function buildScript() {
    setScriptLoading(true);
    try {
      const r = await draft({ data: { reason, preferredTimes: times, targetLang: lang } });
      setScript(r);
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setScriptLoading(false);
    }
  }

  useEffect(() => () => recRef.current?.stop?.(), []);

  return (
    <main className="min-h-screen bg-grid">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold">A</div>
          <div>
            <div className="font-display text-lg font-semibold">Anrufpilot</div>
            <div className="text-xs text-muted-foreground">German phone-call copilot</div>
          </div>
        </div>
        <a
          href="https://github.com"
          className="hidden rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:block"
        >
          Open source · MIT
        </a>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Stop fearing the next <span className="text-primary">deutsches Telefonat</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Live subtitles, AI listening assistant and ready-to-say German replies for calls to the
          Hausarzt, Vermieter, Bürgeramt and Versicherung. Built for Ausländer who get nervous when
          the phone rings.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 lg:grid-cols-[1.2fr_1fr]">
        {/* LIVE CALL */}
        <div className="glass rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-3 w-3 place-items-center rounded-full ${
                  listening ? "bg-primary pulse-ring" : "bg-muted-foreground/40"
                }`}
              />
              <h2 className="font-display text-xl font-semibold">Live call</h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-lg border border-border bg-input px-3 py-1.5 text-sm"
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {listening ? (
                <button
                  onClick={stopListening}
                  className="rounded-lg bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={startListening}
                  className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Start mic (DE)
                </button>
              )}
            </div>
          </div>

          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Call context (e.g. calling my Vermieter about heating)"
            className="mt-4 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm placeholder:text-muted-foreground"
          />

          <div className="mt-5 space-y-2 rounded-2xl border border-border bg-background/40 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">German transcript</div>
            <div className="max-h-56 space-y-1 overflow-auto text-sm">
              {transcript.length === 0 && !interim && (
                <p className="text-muted-foreground">
                  Hold your phone next to the mic, or paste the German below.
                </p>
              )}
              {transcript.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
              {interim && <p className="text-muted-foreground italic">{interim}…</p>}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder='Type / paste German, e.g. "Können Sie am Dienstag um 14 Uhr kommen?"'
              className="flex-1 rounded-xl border border-border bg-input px-3 py-2 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setTranscript((p) => [...p, manual]);
                  runAssist(manual);
                  setManual("");
                }
              }}
            />
            <button
              onClick={() => {
                if (!manual.trim()) return;
                setTranscript((p) => [...p, manual]);
                runAssist(manual);
                setManual("");
              }}
              className="rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground"
            >
              Analyze
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}
        </div>

        {/* COPILOT OUTPUT */}
        <div className="glass rounded-3xl p-6">
          <h2 className="font-display text-xl font-semibold">Copilot</h2>
          <p className="mt-1 text-xs text-muted-foreground">Translation, intent and ready replies in {lang}.</p>

          {loading && <p className="mt-6 text-sm text-muted-foreground">Thinking…</p>}

          {!loading && !result && (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Waiting for the first German utterance. Try: <em>“Guten Tag, hier ist Praxis Dr. Weber.”</em>
            </div>
          )}

          {result && (
            <div className="mt-5 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Translation</div>
                <p className="mt-1 text-base leading-relaxed">{result.translation}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs">intent · {result.intent}</span>
                <span className="text-sm text-muted-foreground">{result.summary}</span>
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Say in German</div>
                <ul className="mt-2 space-y-2">
                  {result.suggestedReplies.map((r, i) => (
                    <li key={i} className="rounded-xl border border-border bg-card/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm">{r}</p>
                        <button
                          onClick={() => speak(r)}
                          className="shrink-0 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                        >
                          ▶ Speak
                        </button>
                      </div>
                      {result.repliesTranslated?.[i] && (
                        <p className="mt-1 text-xs text-muted-foreground">{result.repliesTranslated[i]}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {result.tips?.length > 0 && (
                <div className="rounded-xl border border-signal/40 bg-signal/10 p-3 text-sm">
                  <div className="mb-1 text-xs uppercase tracking-wider text-signal">Tip</div>
                  {result.tips.map((t, i) => <p key={i}>{t}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* APPOINTMENT HELPER */}
        <div className="glass rounded-3xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">Appointment booking helper</h2>
              <p className="text-xs text-muted-foreground">
                Generates a polite German phone script you can READ out loud.
              </p>
            </div>
            <button
              onClick={buildScript}
              disabled={scriptLoading}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {scriptLoading ? "Writing…" : "Generate script"}
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (e.g. Zahnschmerzen)"
              className="rounded-xl border border-border bg-input px-3 py-2 text-sm"
            />
            <input
              value={times}
              onChange={(e) => setTimes(e.target.value)}
              placeholder="Preferred times"
              className="rounded-xl border border-border bg-input px-3 py-2 text-sm"
            />
          </div>

          {script && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Deutsch</span>
                  <button
                    onClick={() => speak(script.germanScript)}
                    className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                  >
                    ▶ Speak slowly
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{script.germanScript}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/40 p-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{lang}</span>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {script.translation}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        Built with TanStack Start + Lovable AI · Made for Ausländer in Deutschland.
      </footer>
    </main>
  );
}
