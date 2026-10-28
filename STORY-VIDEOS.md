# Story videos: changelog and recipe

Each chapter of "Tales from the Safe Room" becomes a short video: its 3 pictures with a slow pan, voiced by narration. Times are Hawaii time (HST).

## 2026-10-28, 9:01 AM HST

**Changed**
- Chapter 8's narration is now -16 LUFS (true peak -1.4 dB), up from -23.3 LUFS, as `ch8-full-v3.mp4`. Picture and timing are unchanged (video copied, audio only re-encoded). The -23 version sounded too quiet on YouTube.
- Narration target for all later chapters is -16 LUFS.

**Removed**
- The line saying -16 LUFS was too loud, and the -23 setting in the recipe below.

## 2026-10-28

**Added**
- Chapter 8 (story id 11, "Death Toll: The Town: The Thing That Stopped Itself") has its full video: 96.45 s, 1920x1080, three pictures, narration, about -23 LUFS. The final cut has the Tank-to-Zoey fade at about 55.5 s (it was first at about 44 s).
- A Worker route that read a chapter aloud with Cloudflare Aura 2 and kept the mp3 in R2 (commits de9b1c4 and 2af6e1d). Removed again the same day, see below.
- Picture upload (a picture made elsewhere is saved as is), used for the Tank, which Flux would not draw (b9b4fb7).

**Removed**
- The temporary copy of the Tank's picture in the repo, once it was in R2 (dbaa9ef).
- The picture-making door: pictures are made elsewhere and uploaded (97900d6).
- The voice route (`GET /api/stories/voice/<id>`, the key-protected `voice` call and `addVoice` in `src/stories.js`) and its test, because narration is made with Azure outside the Worker (7af16be). Any mp3 already in R2 under `story-<id>/voice` was not deleted. Not checked whether one exists.

**Decided**
- Narration is made with Azure text-to-speech, voice "Nancy", tuned in Azure Speech Studio's Audio Content Creation (rate 0.78, pitch 0.98, plus an intonation curve). Aura voices were too light in tone and have no tone settings, so the Aura route was dropped.
- Free Azure resource: files up to 3000 characters, so long chapters are made in parts.
- Music or ambient sound is picked inside YouTube Studio's audio library when uploading. Uploading to YouTube is a manual step.

## How a chapter video is built (ffmpeg, in the workspace, not on Cloudflare)

1. Get the narration (wav or mp3) and the 3 pictures at full size.
2. Scale each picture to 3840x3840 so a 16:9 window can move up and down inside it.
3. Find the pauses in the narration (`silencedetect`, noise -40 dB, 0.6 s) and put the picture changes at sentence breaks, or where asked.
4. Per picture: `crop=3840:2160:0:'y0+(y1-y0)*(1-cos(PI*t/D))/2'`, then `scale=1920:1080,fps=25,format=yuv420p`. Keep the pan speed about the same from picture to picture (chapter 8 is about 34 px/s on the Tank, 17 px/s on the last picture).
5. Join with `xfade=transition=fade:duration=2`. Each clip's length is its fade offset difference plus 2 s; the total is the narration length plus 0.6 s.
6. Audio: `loudnorm=I=-16:TP=-1.5:LRA=11`, `adelay=600|600`, `apad`. (-23 LUFS was too quiet on YouTube. To fix a finished video's loudness without re-encoding the picture: measure with `loudnorm ... print_format=json`, then run again with the `measured_*` values and `-c:v copy`; takes seconds.)
7. Encode: libx264 `-preset veryfast -crf 23`, AAC 192k, `+faststart`. A full chapter takes about 4 minutes.

Chapter 8 timings: the first picture holds through sentence 1 (fade at 8.1 s), the Tank holds until 54.5 s, then Zoey.

## Not done yet
- Chapters 1 to 7 have no pictures. Chapters 9 and 10 have pictures but no narration or video.
