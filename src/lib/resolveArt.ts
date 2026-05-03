import fs from "fs";
import path from "path";

type AssetFolder = "drivers" | "cars" | "parts";

const EXTS = [".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg"];

const PLACEHOLDERS: Record<AssetFolder, string> = {
  drivers: "/assets/drivers/placeholder-3x4.svg",
  cars:    "/assets/cars/placeholder-4x3.svg",
  parts:   "/assets/parts/placeholder-1x1.svg",
};

/**
 * Given an art slug (e.g. "marco_venti") and a folder, returns the public
 * URL of the first matching image file found in public/assets/<folder>/,
 * or the folder's placeholder if nothing is found.
 *
 * Checked extensions in order: .png .jpg .jpeg .webp .avif .svg
 */
export function resolveArt(art: string | null | undefined, folder: AssetFolder): string {
  if (!art) return PLACEHOLDERS[folder];

  const assetDir = path.join(process.cwd(), "public", "assets", folder);

  for (const ext of EXTS) {
    const filePath = path.join(assetDir, `${art}${ext}`);
    if (fs.existsSync(filePath)) {
      return `/assets/${folder}/${art}${ext}`;
    }
  }

  return PLACEHOLDERS[folder];
}
