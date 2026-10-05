/* =========================================================================
   HULK SOUND — English text to speech
   Uses the browser's own Web Speech API: free, offline, no server.
   ========================================================================= */

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const DEFAULT_TEXT = "Hello there.";
/** Played automatically whenever you pick a different voice. */
const SAMPLE = "Hello there.";

/* ---------- State ---------- */
const state = {
  voices: [],
  voiceURI: localStorage.getItem("hulk_voice") || "",
  rate: 1,
  playing: false,
  theme: localStorage.getItem("hulk_theme") || "dark",
};

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}



/* ---------- Voices ---------- */
function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  const list = speechSynthesis.getVoices();
  if (!list.length) return; // not populated yet; voiceschanged / retries handle it

  state.voices = list;
  if (state.voiceURI && !list.some((v) => v.voiceURI === state.voiceURI)) {
    state.voiceURI = ""; // that voice is gone (different device / reinstalled)
  }
  renderVoiceMenu();
}

function renderVoiceMenu() {
  const sel = $("#voicePick");
  // English only — this app speaks English, so other languages would just misread it.
  const english = state.voices.filter(isEnglish);

  $("#voiceLangNote").textContent = english.length
    ? `${english.length} English voice${english.length === 1 ? "" : "s"} available`
    : "No English voices found";

  sel.innerHTML = "";

  english.forEach((v) => {
    const o = document.createElement("option");
    o.value = v.voiceURI;
    o.textContent = `${v.name} — ${v.lang}`;
    sel.appendChild(o);
  });

  // Fall back to the first English voice.
  if (!state.voiceURI || !english.some((v) => v.voiceURI === state.voiceURI)) {
    state.voiceURI = english[0]?.voiceURI || "";
  }
  if (state.voiceURI) sel.value = state.voiceURI;

  $("#voicesFallback").classList.toggle("hidden", english.length > 0);
}

const EN_TAGS = ["en", "en-us", "en-gb", "en-au", "en-ca", "en-in", "en-ie", "en-nz", "en-za", "en-scotland"];

function isEnglish(v) {
  const tag = (v.lang || "").toLowerCase().replace(/_/g, "-");
  if (!tag) return false;
  return EN_TAGS.some((m) => tag === m || tag.startsWith(m + "-"));
}

/** The voice currently chosen in the menu, or null. */
function currentVoice() {
  return state.voices.find((v) => v.voiceURI === state.voiceURI) || null;
}

/* ---------- Speech ---------- */
// Bumped on stop so pending pause-timers bail out instead of resuming the voice.
let speechToken = 0;
// Resolver for the run in flight, so stop() can settle it instead of hanging.
let activeFinish = null;

/** Speak text aloud. Resolves true when finished, false if stopped. */
function speakText(text) {
  stopSpeech(); // never let two queues run at once
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      toast("Speech is not supported in this browser");
      return resolve(false);
    }
    const voice = currentVoice();
    const clean = (text || "").trim();
    if (!clean) return resolve(false);
    if (!voice) {
      toast("No voice selected");
      return resolve(false);
    }

    const myToken = ++speechToken;
    // Split into sentences and pause between them — reads far more naturally.
    const chunks = clean
      .split(/(?<=[.!?)])\s+|\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!chunks.length) return resolve(false);

    let idx = 0;
    state.playing = true;
    setPlayButton(true);
    setStatus("Reading…", true);

    // Always settles exactly once, even if superseded — otherwise `await` hangs.
    const finish = (ok) => {
      if (activeFinish === finish) activeFinish = null;
      if (myToken === speechToken) {
        state.playing = false;
        setPlayButton(false);
        setStatus(ok ? "Done" : "");
      }
      resolve(ok);
    };
    activeFinish = finish;

    const speakNext = () => {
      if (myToken !== speechToken) return finish(false);
      if (idx >= chunks.length) return finish(true);

      const u = new SpeechSynthesisUtterance(chunks[idx++]);
      u.voice = voice;
      u.lang = voice.lang || "en-US";
      u.rate = clamp(state.rate, 0.1, 10);
      u.pitch = 1;
      u.volume = 1;

      u.onend = () => setTimeout(speakNext, 160);
      u.onerror = (e) => {
        // "interrupted"/"canceled" are the normal result of pressing Stop.
        if (e.error === "interrupted" || e.error === "canceled") return;
        finish(false);
      };
      speechSynthesis.speak(u);
    };

    speakNext();
  });
}

function stopSpeech() {
  speechToken++;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  state.playing = false;
  setPlayButton(false);
  if (activeFinish) activeFinish(false); // settle the promise so callers don't hang
}

/**
 * Stop mid-sentence and read the same text again from the start. Used when a
 * setting changes mid-playback (speed, for instance) so the change is audible
 * immediately rather than only on the next run.
 */
function restartSpeech() {
  const text = $("#srcText").value.trim();
  if (!text) {
    stopSpeech();
    return;
  }
  speakText(text);
}

/** One button: shows ▶ Play while idle, ■ Stop while the voice is reading. */
function setPlayButton(playing) {
  $("#playIco").classList.toggle("hidden", playing);
  $("#stopIco").classList.toggle("hidden", !playing);
  $("#playLabel").textContent = playing ? "Stop" : "Play";
  $("#playBtn").classList.toggle("is-playing", playing);
  $("#playBtn").setAttribute("aria-label", playing ? "Stop" : "Play");
}

function setStatus(msg, busy = false) {
  const el = $("#tStatus");
  el.textContent = msg;
  el.classList.toggle("busy", busy);
}

/* ---------- Speed ---------- */
/**
 * Apply a new speed. If the voice is mid-sentence it stops and reads the text
 * again from the top, so the new speed is audible immediately rather than only
 * on the next run.
 */
function applyRate(next) {
  const rate = clamp(Math.round(next * 20) / 20, 0.5, 2); // 0.05 steps
  state.rate = rate;
  $("#rate").value = rate;
  $("#rateVal").textContent = rate.toFixed(2) + "×";
  // 0.5 and 2 are the ends of the range: nothing to step to from there.
  $("#rateDown").disabled = rate <= 0.5;
  $("#rateUp").disabled = rate >= 2;
  if (state.playing) restartSpeech();
}

/* ---------- Events ---------- */
function bind() {
  $("#themeBtn").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("hulk_theme", state.theme);
  });

  $("#clearBtn").addEventListener("click", () => {
    stopSpeech();
    $("#srcText").value = "";
    toast("Cleared");
  });

  $("#rate").addEventListener("input", (e) => applyRate(+e.target.value));
  $("#rateUp").addEventListener("click", () => applyRate(state.rate + 0.1));
  $("#rateDown").addEventListener("click", () => applyRate(state.rate - 0.1));

  // Picking a voice always plays a sample, so you hear what you chose.
  $("#voicePick").addEventListener("change", (e) => {
    state.voiceURI = e.target.value;
    localStorage.setItem("hulk_voice", state.voiceURI);
    speakText(SAMPLE); // mandatory: you always hear the voice you just picked
  });

  /* Play / Stop in one button: press while idle to read, press again to cut off. */
  $("#playBtn").addEventListener("click", () => {
    if (state.playing) {
      stopSpeech();
      return setStatus("Stopped");
    }
    const text = $("#srcText").value.trim();
    if (!text) return toast("Type some text first");
    speakText(text);
  });

  // Space toggles play/stop unless the user is typing in the textarea.
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (document.activeElement === $("#playBtn")) return;
    e.preventDefault();
    $("#playBtn").click();
  });

  // Never leave the voice reading after navigation.
  window.addEventListener("beforeunload", stopSpeech);

  if ("speechSynthesis" in window) {
    speechSynthesis.addEventListener("voiceschanged", loadVoices);
    loadVoices();
    setTimeout(loadVoices, 350); // Chrome populates the list asynchronously
    setTimeout(loadVoices, 1200);
  } else {
    $("#voicesFallback").classList.remove("hidden");
    toast("Speech is not supported in this browser");
  }
}

/* ---------- Init ---------- */
document.documentElement.setAttribute("data-theme", state.theme);
$("#srcText").value = DEFAULT_TEXT;
setPlayButton(false);
applyRate(1); // also disables the step buttons at the limits
renderVoiceMenu();
bind();