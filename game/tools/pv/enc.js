// 홍보 영상 도구(브라우저 쪽): 캔버스를 한 장씩 H.264로 굽고 MP4로 묶는다(WebCodecs + mp4-muxer).
// 같은 조각을 .bin(우리 형식)으로도 남겨 합성 페이지가 VideoDecoder로 순서대로 다시 읽는다.
import { Muxer, ArrayBufferTarget } from "https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/build/mp4-muxer.mjs";

export function makeEncoder({ width, height, fps = 60, bitrate = 20e6, audio = null, keyEvery = 60 }) {
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: "avc", width, height, frameRate: fps }, audio: audio ? { codec: "aac", numberOfChannels: audio.channels, sampleRate: audio.sampleRate } : undefined, fastStart: "in-memory", firstTimestampBehavior: "offset" });
  const chunks = []; let desc = null, err = null;
  const ve = new VideoEncoder({ output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta); if (meta?.decoderConfig?.description) desc = new Uint8Array(meta.decoderConfig.description.buffer ? meta.decoderConfig.description.buffer : meta.decoderConfig.description).slice(); const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); chunks.push({ t: chunk.timestamp, k: chunk.type === "key" ? 1 : 0, d }); }, error: (e) => (err = e) });
  const codec = height > 1080 ? "avc1.640033" : "avc1.64002A";
  ve.configure({ codec, width, height, bitrate, framerate: fps, latencyMode: "quality", avc: { format: "avc" } });
  let ae = null;
  if (audio) { ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (err = e) }); ae.configure({ codec: "mp4a.40.2", sampleRate: audio.sampleRate, numberOfChannels: audio.channels, bitrate: 192000 }); }
  let n = 0;
  return {
    get frames() { return n; },
    async addFrame(source) {
      if (err) throw err;
      const f = new VideoFrame(source, { timestamp: Math.round((n * 1e6) / fps), duration: Math.round(1e6 / fps) });
      ve.encode(f, { keyFrame: n % keyEvery === 0 }); f.close(); n++;
      while (ve.encodeQueueSize > 3) await new Promise((r) => setTimeout(r, 0));
    },
    async addAudio(buffer) { // AudioBuffer 통째로
      const ch = buffer.numberOfChannels, sr = buffer.sampleRate, step = 4800;
      for (let off = 0; off < buffer.length; off += step) {
        const len = Math.min(step, buffer.length - off), data = new Float32Array(len * ch);
        for (let c = 0; c < ch; c++) data.set(buffer.getChannelData(c).subarray(off, off + len), c * len);
        const ad = new AudioData({ format: "f32-planar", sampleRate: sr, numberOfFrames: len, numberOfChannels: ch, timestamp: Math.round((off * 1e6) / sr), data });
        ae.encode(ad); ad.close();
        while (ae.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
      }
    },
    async finish() {
      await ve.flush(); if (ae) await ae.flush(); if (err) throw err; muxer.finalize();
      const mp4 = new Uint8Array(target.buffer);
      // .bin: [4바이트 머리 길이][머리 JSON][조각들]
      let off = 0; const index = chunks.map((c) => { const r = [c.t, c.k, off, c.d.length]; off += c.d.length; return r; });
      const head = new TextEncoder().encode(JSON.stringify({ codec, width, height, fps, description: desc ? btoa(String.fromCharCode(...desc)) : null, chunks: index }));
      const bin = new Uint8Array(4 + head.length + off); new DataView(bin.buffer).setUint32(0, head.length, true); bin.set(head, 4);
      let p = 4 + head.length; for (const c of chunks) { bin.set(c.d, p); p += c.d.length; }
      return { mp4, bin };
    },
  };
}

// .bin 조각을 순서대로 풀어 원하는 시각(초)의 화면을 준다. 시간은 앞으로만 간다(되감으려면 새로 만든다).
export async function openClip(url) {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const hl = new DataView(buf.buffer).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + hl))), base = 4 + hl;
  const description = head.description ? Uint8Array.from(atob(head.description), (c) => c.charCodeAt(0)) : undefined;
  return {
    head, duration: head.chunks.length / head.fps,
    reader(startSec = 0) {
      const out = []; let err = null, i = 0, ended = false, last = null, waiters = [];
      const dec = new VideoDecoder({ output: (f) => { out.push(f); waiters.splice(0).forEach((w) => w()); }, error: (e) => { err = e; waiters.splice(0).forEach((w) => w()); } });
      dec.configure({ codec: head.codec, codedWidth: head.width, codedHeight: head.height, description });
      const startUs = startSec * 1e6; // 시작 시각 앞의 가장 가까운 key부터
      for (let j = 0; j < head.chunks.length; j++) if (head.chunks[j][1] && head.chunks[j][0] <= startUs + 1) i = j;
      const feed = () => { const c = head.chunks[i++]; dec.decode(new EncodedVideoChunk({ type: c[1] ? "key" : "delta", timestamp: c[0], data: buf.subarray(base + c[2], base + c[2] + c[3]) })); };
      return {
        // 영상 시각 t(초) 이하에서 가장 늦은 화면(VideoFrame). 돌려준 화면은 다음 호출 때 닫힌다.
        async frameAt(t) {
          const us = t * 1e6 + 1;
          for (;;) {
            if (err) throw err;
            while (out.length && out[0].timestamp <= us) { if (last) last.close(); last = out.shift(); }
            if (out.length || ended) return last;
            if (i < head.chunks.length) { feed(); if (dec.decodeQueueSize > 2) await new Promise((r) => { waiters.push(r); setTimeout(r, 30); }); else await new Promise((r) => setTimeout(r, 0)); }
            else { await dec.flush(); ended = true; }
          }
        },
        close() { out.forEach((f) => f.close()); if (last) last.close(); try { dec.close(); } catch (e) {} },
      };
    },
  };
}
