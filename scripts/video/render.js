import { mkdirSync } from 'fs';
import { join } from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { COMPOSITION_ID, QA_DIR, REMOTION_ENTRY } from './config.js';

export async function createRenderContext(inputProps) {
  const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY });
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });
  return { serveUrl, composition };
}

export async function renderVideo(context, inputProps, outputPath, codec = 'h264') {
  await renderMedia({
    ...context,
    codec,
    outputLocation: outputPath,
    inputProps,
  });
}

export async function renderQaStills(context, inputProps, slug) {
  const outputDir = join(QA_DIR, slug);
  mkdirSync(outputDir, { recursive: true });
  const lastFrame = context.composition.durationInFrames - 1;
  const ctaSegment = inputProps.segments?.find((segment) => segment.role === 'cta');
  const bodySegment = inputProps.segments?.find((segment) => segment.role === 'body');
  const frames = inputProps.segments?.length
    ? {
      hook: Math.min(lastFrame, Math.max(0, inputProps.segments[0].startFrame + 12)),
      info: Math.min(lastFrame, Math.max(0, (bodySegment?.startFrame ?? Math.round(lastFrame * 0.5)) + 12)),
      cta: Math.min(lastFrame, Math.max(0, (ctaSegment?.startFrame ?? Math.round(lastFrame * 0.9)) + 12)),
    }
    : {
      hook: Math.round(lastFrame * 0.1),
      info: Math.round(lastFrame * 0.5),
      cta: Math.round(lastFrame * 0.9),
    };

  for (const [name, frame] of Object.entries(frames)) {
    await renderStill({
      ...context,
      output: join(outputDir, `${name}.png`),
      inputProps,
      frame,
    });
  }

  return outputDir;
}
