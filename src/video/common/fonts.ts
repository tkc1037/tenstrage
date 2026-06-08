/**
 * Font loading for remotion-scenes
 * 日本語表示に必要なウェイトのみロード（700/800/900）
 */

import { loadFont as loadNotoSansJP } from "@remotion/google-fonts/NotoSansJP";

const { fontFamily } = loadNotoSansJP("normal", {
  subsets: ["japanese", "latin"],
  weights: ["700", "800", "900"],
});

export const font = fontFamily;
