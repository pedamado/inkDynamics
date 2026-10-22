// ═══════════════════════════════════════════════════════════════════════════
// INK DYNAMICS — TextureGen.js
// Procedural paper grain generator for Hot-Press (Smooth) and
// Cold-Press (Rough / Toothy Watercolor) paper substrates.
// ═══════════════════════════════════════════════════════════════════════════

export class TextureGen {
  /**
   * Generates a seamless tileable paper tooth noise canvas.
   * @param {number} size - Tile dimension (e.g. 256)
   * @param {number} roughness - Paper tooth intensity (0.0 to 1.0)
   * @returns {HTMLCanvasElement}
   */
  static createPaperTile(size = 256, roughness = 0.4) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    // Multi-octave Perlin/fractal-like noise using white noise + blur
    for (let i = 0; i < data.length; i += 4) {
      // Base paper tint: warm, natural archival white / cream (#faf8f5)
      const baseR = 250;
      const baseG = 248;
      const baseB = 245;

      // Micro tooth grain
      const noise = (Math.random() - 0.5) * roughness * 38;
      // High-frequency fiber specks
      const fiber = Math.random() < 0.003 ? -18 : 0;

      data[i] = Math.max(0, Math.min(255, baseR + noise + fiber));
      data[i + 1] = Math.max(0, Math.min(255, baseG + noise + fiber));
      data[i + 2] = Math.max(0, Math.min(255, baseB + noise + fiber));
      data[i + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }
}
