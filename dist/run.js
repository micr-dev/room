// ==========================================================
// ZIP‑BASED ASCII ANIMATION LOADER (fflate)
// ==========================================================
/**
 * @fileoverview ASCII animation player for micr.dev.
 * Loads a ZIP archive of pre-rendered text frames and plays them
 * back in the browser console at a configurable FPS, optionally
 * synchronised with an audio track.
 *
 * The ZIP is fetched once and kept in memory (`FRAME_MAP`).  On
 * tab blur the animation pauses; on focus it clears the intro.
 * Type `makeLove()` in the console to start the Bad Apple!!
 * ASCII playback with audio.
 *
 * @module run
 * @requires fflate (ESM, loaded from CDN)
 */

import {
  unzipSync,
  strFromU8,
} from "./vendor/fflate.js";

const ZIP_PATH = "./assets/frames.zip";
const totalFrames = 6572;
const fps = 30;
const indent = "        ";

let FRAME_MAP = null;
let zipReady = false;

/**
 * Fetch and decompress the frames ZIP from the server.
 * Idempotent — subsequent calls return immediately.
 * @returns {Promise<void>}
 */
async function loadZip() {
  if (zipReady) return;

  const res = await fetch(ZIP_PATH);
  const buf = new Uint8Array(await res.arrayBuffer());

  FRAME_MAP = unzipSync(buf);
  zipReady = true;

  console.log(
    "(ASCII ZIP extracted:",
    Object.keys(FRAME_MAP).length,
    "frames)"
  );
}

/**
 * Retrieve the raw text content of a single frame by index.
 * Loads the ZIP lazily on the first call.
 * @param {number} idx - Zero-padded frame index (1–6572).
 * @returns {Promise<string|null>} Frame text or `null` if not found.
 */
async function getFrame(idx) {
  if (!zipReady) await loadZip();

  const name = "out" + idx.toString().padStart(4, "0") + ".jpg.txt";
  const entry = FRAME_MAP[name];
  if (!entry) return null;

  return strFromU8(entry);
}

/**
 * No-op preload stub — the ZIP approach requires no separate
 * network requests per frame.  Kept for API compatibility.
 * @returns {Promise<void>}
 */
async function preloadFrames() { return; }

// ==========================================================
// ANIMATION LOGIC
// ==========================================================

let frameIndex = 1;
let interval = null;
let stopFlag = false;

/** Pause animation and restart intro when the tab loses focus. */
window.addEventListener("blur", () => {
  if (!interval) return;

  stopFlag = true;
  clearInterval(interval);
  interval = null;

  if (window.eggAudio) {
    window.eggAudio.pause();
    window.eggAudio.currentTime = 0;
  }

  setTimeout(() => {
    console.clear();
    intro();
  }, 200);
});

/** Log a message when the tab regains focus — animation stays paused. */
window.addEventListener("focus", () => {
  console.log("(animation paused — tab re-focused)");
});

/** Advance the animation one line on each call. */
function softClear() {
  console.log("\n");
}

// ==========================================================
// PLAYBACK
// ==========================================================

/**
 * Begin ASCII frame playback in the browser console.
 * Schedules `getFrame` lookups at `1000/fps` ms intervals and
 * writes each frame to `console.log`.  When all frames are
 * exhausted a credits line is printed after a 1 s delay.
 * @returns {Promise<void>}
 */
async function playAscii() {
  if (interval) return;
  stopFlag = false;
  frameIndex = 1;

  await preloadFrames();

  let firstFrame = true;

  interval = setInterval(async () => {
    if (stopFlag || frameIndex > totalFrames) {
      clearInterval(interval);
      interval = null;

      setTimeout(() => {
        console.log(
          "\n\n" +
            "【Touhou】Bad Apple!! Gameboy 8-bit ver. by 檜風呂\n" +
            "https://www.nicovideo.jp/watch/sm8954478\n"
        );
      }, 1000);

      return;
    }

    const frame = await getFrame(frameIndex);
    if (frame) {
      // Delay audio by 0.5 s after frame 1
      if (firstFrame) {
        firstFrame = false;
        requestAnimationFrame(() => {
          if (window.playEggAudio)
            setTimeout(() => window.playEggAudio(), 700);
        });
      }

      console.log(
        "\n".repeat(25) + indent + frame.replace(/\n/g, "\n" + indent)
      );
    }

    frameIndex++;
  }, 1000 / fps);
}

// ==========================================================
// INTRO + PUBLIC API
// ==========================================================

/**
 * Print the ASCII art intro banner to the console.
 */
function intro() {
  console.log(
    "\n" +
      `
_____________________________________________________________________/\\\\\\_______________________________        
 ____________________________________________________________________\\/\\___/\\\\\\_______________________________       
  ______________________/\\___/\\\\\\__________________________________________\\/\\___\\/\\______________/\\\\\\_______________________      
   ____/\\\\\\_________/\\\\\\____/\\\\\\___\\////______/\\\\\\_________\\/\\\\\\____/\\\\\\____/\\\\\\_______________\\/\\______      
    __/\\\\\\///\\\\\\____/\\\\\\///\\\\\\___/\\\\\\_________\\/\\\\\\___/\\\\\\_________\\/\\\\\\______/\\\\\\///___________\\/\\_______     
     _\\/\\\\\\__\\///\\\\\\__\\/\\\\\\__\\//\\\\\\___\\/\\\\\\_________\\/\\\\\\__/\\\\\\_________\\/\\\\\\______\\////____________\\/\\______    
      _\\/\\\\\\____\\/\\\\\\__\\/\\\\\\____\\/\\\\\\__\\/\\\\\\_________\\/\\\\\\_\\/\\\\\\_________\\/\\\\\\___________________________\\/\\______   
       _\\/\\\\\\____\\/\\\\\\__\\/\\\\\\____\\/\\\\\\__\\/\\\\\\_________\\/\\\\\\__\\/\\\\\\_________\\/\\\\\\__________________________\\/\\______  
        _\\/\\\\\\____\\/\\\\\\__\\/\\\\\\____\\/\\\\\\__\\/\\\\\\_________\\/\\\\\\___\\/\\\\\\_________\\/\\\\\\__________________________\\/\\______ 
         _\\/\\\\\\____\\/\\\\\\__\\/\\\\\\____\\/\\\\\\__\\/\\\\\\_________\\/\\\\\\____\\/\\\\\\_________\\/\\\\\\__________________________\\/\\______
          _\\/\\//\\____\\///___\\///_____\\///___\\/\\//_________\\///_____\\///__________\\///__________________________\\///_______

        whether you are a curious explorer or a developer tinkering with my website,
        you've found this easter egg! your efforts won't go to waste.
        type "makeLove()" and press enter :)

                                         and don't forget to ★ the repo: github.com/Microck/micr.dev
`
  );
}

/**
 * Trigger the Bad Apple!! ASCII animation with audio.
 * Exposed as `window.makeLove` for console access.
 */
function makeLove() {
  console.log("\nnot war?");
  setTimeout(() => {
    playAscii();
  }, 500);
}

window.makeLove = makeLove;
intro();

// ==========================================================
// AUDIO HANDLER
// ==========================================================

const eggAudio = new Audio("./assets/run.ogg");
eggAudio.preload = "none";
eggAudio.volume = 0.25;

/**
 * Play the ``run.ogg`` audio track from the start.
 * Exposed as `window.playEggAudio`.
 */
window.playEggAudio = function () {
  eggAudio.currentTime = 0;
  eggAudio.play();
};
