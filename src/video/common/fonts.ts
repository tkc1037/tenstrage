import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const font = "Noto Sans JP";

for (const weight of ["700", "800", "900"] as const) {
  loadFont({
    family: font,
    url: staticFile(`fonts/noto-sans-jp-${weight}.woff2`),
    weight,
  });
}
