import ComingSoon from "@/components/ui/ComingSoon";

export default function RacePage() {
  return (
    <ComingSoon
      title="Race HQ"
      description="Deploy your drivers on auto-battle race events. Select a circuit, assign a driver and car, and watch the credits and materials roll in. The track awaits."
      icon={
        <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M4 48L4 40 Q6 32 14 27 L20 22 Q32 18 44 22 L50 27 Q58 32 60 40 L60 48"/>
          <rect x="4" y="46" width="56" height="4"/>
          <circle cx="16" cy="50" r="7" strokeWidth="1.5"/>
          <circle cx="48" cy="50" r="7" strokeWidth="1.5"/>
          <path d="M28 18 L36 18" strokeWidth="2" strokeLinecap="round"/>
          <path d="M32 14 L32 22" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      }
    />
  );
}
