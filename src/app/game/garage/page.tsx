import ComingSoon from "@/components/ui/ComingSoon";

export default function GaragePage() {
  return (
    <ComingSoon
      title="Garage"
      description="Your fleet of Blackridge vehicles will live here. Assemble cars from crafted parts, configure builds, and prepare your vehicles for the track or the market."
      icon={
        <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M8 44L8 36 Q10 28 18 24 L26 20 Q28 16 32 16 Q36 16 38 20 L46 24 Q54 28 56 36 L56 44 Z"/>
          <rect x="8" y="42" width="48" height="4"/>
          <circle cx="20" cy="46" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="44" cy="46" r="7" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      }
    />
  );
}
