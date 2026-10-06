// Independent Three.js scene loader. No Spline runtime is imported.
export class Application {
  constructor(canvas) {
    this.canvas = canvas;
  }
  async load(url) {
    if (url) {
      const response = await fetch(url);
      if (!response.ok) throw Error("Scene document unavailable");
      window.__ROOM_DOCUMENT__ = await response.json();
    }
    await import("./app.js");
    window.room.start();
  }
}
