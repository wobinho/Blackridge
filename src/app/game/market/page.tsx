import ComingSoon from "@/components/ui/ComingSoon";

export default function MarketPage() {
  return (
    <ComingSoon
      title="Marketplace"
      description="The Blackridge open market. List your cars and parts for other brands to buy. Browse deals, make acquisitions, and grow your revenue through commerce as much as racing."
      icon={
        <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M8 8h6l10 32h26l8-22H20"/>
          <circle cx="28" cy="54" r="4"/>
          <circle cx="48" cy="54" r="4"/>
        </svg>
      }
    />
  );
}
