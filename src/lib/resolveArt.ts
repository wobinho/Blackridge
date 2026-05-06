type AssetFolder = "drivers" | "cars" | "parts";

const PLACEHOLDERS: Record<AssetFolder, string> = {
  drivers: "/assets/drivers/placeholder-3x4.svg",
  cars:    "/assets/cars/placeholder-4x3.svg",
  parts:   "/assets/parts/placeholder-1x1.svg",
};

export function resolveArt(art: string | null | undefined, folder: AssetFolder): string {
  if (!art) return PLACEHOLDERS[folder];
  return `/assets/${folder}/${art}.png`;
}
