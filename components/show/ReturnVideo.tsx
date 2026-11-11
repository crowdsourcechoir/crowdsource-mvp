"use client";

import { useEffect, useRef, useState } from "react";
import { stepBoomerang } from "@/lib/show-slides/model";

const FRAME_HZ = 12;

/**
 * Plays a clip forward, then back through the same frames, then forward again.
 * The turnaround is the last picture, so the loop does not cut to the first frame.
 * A speed below 1 is slow motion. Browsers cannot play compressed video backward,
 * so the forward pass keeps the decoded frames and draws them in reverse.
 */
export default function ReturnVideo({
  src,
  poster,
  speed = 1,
}: {
  src: string;
  poster?: string;
  speed?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [framesOn, setFramesOn] = useState(false);
  const [showPoster, setShowPoster] = useState(Boolean(poster));

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const videoEl: HTMLVideoElement = video;
    const canvasEl: HTMLCanvasElement = canvas;
    const ctx = canvasEl.getContext("2d");
    let cancelled = false;
    let raf = 0;
    const frames: ImageBitmap[] = [];
    let capturing = false;
    let lastMedia = -1;
    let playingFrames = false;

    setFramesOn(false);
    setShowPoster(Boolean(poster));
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.loop = false;
    videoEl.playbackRate = speedRef.current;

    function playFrames() {
      if (cancelled || playingFrames || !ctx || frames.length < 2) {
        if (!playingFrames && frames.length < 2) {
          videoEl.loop = true;
          videoEl.playbackRate = speedRef.current;
          void videoEl.play().catch(() => undefined);
        }
        return;
      }
      playingFrames = true;
      setFramesOn(true);
      setShowPoster(false);
      videoEl.pause();
      canvasEl.width = frames[0]!.width;
      canvasEl.height = frames[0]!.height;
      let index = frames.length - 1;
      let direction: 1 | -1 = -1;
      let acc = 0;
      let last = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const dt = now - last;
        last = now;
        acc += dt;
        const frameMs = Math.max(16, 1000 / FRAME_HZ / Math.max(0.25, speedRef.current));
        while (acc >= frameMs) {
          acc -= frameMs;
          const step = stepBoomerang(index, direction, frames.length);
          index = step.index;
          direction = step.direction;
        }
        ctx.drawImage(frames[index]!, 0, 0, canvasEl.width, canvasEl.height);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function capture(mediaTime: number) {
      if (cancelled || capturing || playingFrames || frames.length >= 96) return;
      if (mediaTime - lastMedia < 1 / FRAME_HZ) return;
      lastMedia = mediaTime;
      capturing = true;
      createImageBitmap(videoEl, { resizeWidth: 960, resizeQuality: "medium" })
        .then((bitmap) => {
          capturing = false;
          if (cancelled) {
            bitmap.close();
            return;
          }
          frames.push(bitmap);
          if (videoEl.ended) playFrames();
        })
        .catch(() => {
          capturing = false;
          frames.forEach((bitmap) => bitmap.close());
          frames.length = 0;
          playingFrames = true;
          videoEl.loop = true;
          void videoEl.play().catch(() => undefined);
        });
    }

    function onFrame(_now: number, metadata: { mediaTime: number }) {
      if (cancelled || playingFrames) return;
      capture(metadata.mediaTime);
      videoEl.requestVideoFrameCallback(onFrame);
    }

    function onEnded() {
      playFrames();
    }

    function onPlaying() {
      setShowPoster(false);
    }

    videoEl.addEventListener("ended", onEnded);
    videoEl.addEventListener("playing", onPlaying);
    if ("requestVideoFrameCallback" in videoEl) videoEl.requestVideoFrameCallback(onFrame);
    void videoEl.play().catch(() => undefined);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      videoEl.removeEventListener("ended", onEnded);
      videoEl.removeEventListener("playing", onPlaying);
      videoEl.pause();
      frames.forEach((bitmap) => bitmap.close());
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && !framesOn) video.playbackRate = speed;
  }, [speed, framesOn]);

  return (
    <div className="absolute inset-0" aria-hidden>
      {poster ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${poster}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: showPoster ? 1 : 0,
          }}
        />
      ) : null}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: framesOn || showPoster ? 0 : 1 }}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="auto"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: framesOn ? 1 : 0 }}
      />
    </div>
  );
}
