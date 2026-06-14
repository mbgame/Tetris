import type { MetadataRoute } from "next";

/** PWA manifest — installable, launches straight into the game. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ChromaSand",
    short_name: "ChromaSand",
    description: "A color-clearing tetromino puzzle where cleared rows pour into sand.",
    start_url: "/play",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
