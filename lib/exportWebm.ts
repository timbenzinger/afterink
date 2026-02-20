/**
 * WebM export using MediaRecorder with VP9 codec.
 *
 * Renders pre-computed PNG frame blobs onto a 2D canvas one-by-one,
 * using captureStream(0) with manual requestFrame() for deterministic
 * frame-accurate recording.
 */

export async function exportWebm(
  frames: Blob[],
  width: number,
  height: number,
  fps: number
): Promise<Blob> {
  // Create an offscreen 2D canvas for drawing frames
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // captureStream(0) → manual frame pushing via requestFrame()
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;

  // Choose the best available VP9 mime type
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  // Draw each frame and push it to the recorder
  for (const frameBlob of frames) {
    const bitmap = await createImageBitmap(frameBlob);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // Push the current canvas state as a video frame
    track.requestFrame();

    // Give the encoder time to process the frame.
    // The delay matches the target frame duration.
    await sleep(1000 / fps);
  }

  recorder.stop();
  return done;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extend the built-in type for CanvasCaptureMediaStreamTrack */
interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  requestFrame(): void;
}
