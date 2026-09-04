// Generates macOS menu bar (status item) template icons from the master app icon.
//
// macOS draws template images using only their alpha channel and automatically
// inverts them for light/dark menu bars. The master icon has an opaque rounded
// square background, so we export a luminance mask of the bright "S" mark with
// a fully transparent background at 16x16 (@1x) and 32x32 (@2x).
//
// Run: npm run mac:icons
const { app, nativeImage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

function luminanceMaskToPng(source, size) {
  const scaled = source.resize({ width: size, height: size, quality: "best" });
  const { width, height } = scaled.getSize();
  const bitmap = scaled.toBitmap(); // BGRA, 4 bytes per pixel
  const out = Buffer.alloc(bitmap.length);
  for (let offset = 0; offset < bitmap.length; offset += 4) {
    const blue = bitmap[offset];
    const green = bitmap[offset + 1];
    const red = bitmap[offset + 2];
    const alpha = bitmap[offset + 3];
    if (alpha === 0) continue;
    const luminance = Math.max(red, green, blue);
    if (luminance > 96) {
      // Bright mark -> opaque black shape for the template.
      out[offset] = 0;
      out[offset + 1] = 0;
      out[offset + 2] = 0;
      out[offset + 3] = 255;
    } else {
      // Dark background -> transparent so the menu bar is not covered.
      out[offset + 3] = 0;
    }
  }
  const mask = nativeImage.createFromBitmap(out, { width, height });
  return mask.toPNG();
}

app.whenReady().then(() => {
  const electronDir = path.resolve(__dirname, "..", "electron");
  const master = nativeImage.createFromPath(
    path.resolve(__dirname, "..", "assets", "accio-switch-icon-master.png"),
  );
  if (master.isEmpty()) {
    console.error("Unable to load the master app icon.");
    app.exit(1);
    return;
  }
  fs.writeFileSync(path.join(electronDir, "tray-iconTemplate.png"), luminanceMaskToPng(master, 16));
  fs.writeFileSync(path.join(electronDir, "tray-iconTemplate@2x.png"), luminanceMaskToPng(master, 32));
  console.log("Generated electron/tray-iconTemplate.png and electron/tray-iconTemplate@2x.png");
  app.exit(0);
});
