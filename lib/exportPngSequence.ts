/**
 * PNG sequence export using fflate for ZIP compression.
 *
 * Takes an array of PNG Blobs (one per frame), packs them into a ZIP,
 * and returns the ZIP as a downloadable Blob.
 */

import { zipSync, Zippable } from "fflate";

export async function exportPngSequence(frames: Blob[]): Promise<Blob> {
  const files: Zippable = {};

  // Convert each Blob to Uint8Array and add to the zip
  for (let i = 0; i < frames.length; i++) {
    const arrayBuffer = await frames[i].arrayBuffer();
    const padded = String(i).padStart(4, "0");
    files[`frame_${padded}.png`] = new Uint8Array(arrayBuffer);
  }

  // Synchronous zip (fflate is fast enough for this use case)
  const zipped = zipSync(files, { level: 0 }); // level 0 = store (PNGs are already compressed)

  return new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
}
