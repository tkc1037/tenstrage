/**
 * Font loading for remotion-scenes
 * latin subset + 使用ウェイトのみロード（700/800/900）
 */

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadInter("normal", {
  subsets: ["latin"],
  weights: ["700", "800", "900"],
});

export const font = fontFamily;
