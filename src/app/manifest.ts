import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Slipboxd",
    short_name: "Slipboxd",
    description: "Turn your Letterboxd diary into a receipt.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#f5f5f5",
    icons: [{ src: "/icon.png", sizes: "500x500", type: "image/png" }],
  };
}
