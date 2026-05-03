import ComingSoon from "@/components/ui/ComingSoon";

export default function WorkshopPage() {
  return (
    <ComingSoon
      title="Workshop"
      description="Craft precision parts from raw materials. Queue multiple builds, tier up your components, and supply your garage — or the market — with premium Blackridge engineering."
      icon={
        <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="32" cy="32" r="12"/>
          <circle cx="32" cy="32" r="6"/>
          <circle cx="32" cy="32" r="2" fill="currentColor"/>
          <path d="M32 8v8M32 48v8M8 32h8M48 32h8"/>
          <path d="M17 17l5.5 5.5M41.5 41.5L47 47M17 47l5.5-5.5M41.5 22.5L47 17"/>
        </svg>
      }
    />
  );
}
