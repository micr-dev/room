import { Application } from "./adapter.js";

function showLoadError(error) {
  console.error(error);
  document.getElementById("status").textContent =
    "Room failed to load: " + error.message;
  document.getElementById("enter").hidden = true;
  document.getElementById("cover").hidden = false;
}

new Application(document.getElementById("canvas3d"))
  .load()
  .then(() => {
    import("./crt-integration.js")
      .then(({ initCRTEffect }) =>
        initCRTEffect(document.getElementById("canvas3d")),
      )
      .catch(console.error);
  })
  .catch(showLoadError);
