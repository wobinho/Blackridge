import Link from "next/link";

interface Props {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export default function ComingSoon({ title, description, icon }: Props) {
  return (
    <div className="md:ml-16 pb-20 md:pb-6">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-16 text-center">
        {icon && (
          <div className="flex justify-center mb-6 text-[#2a2a2a]">{icon}</div>
        )}
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="w-8 h-px bg-[#e8001c]" />
          <span className="section-tag">Coming Soon</span>
          <span className="w-8 h-px bg-[#e8001c]" />
        </div>
        <h1
          className="text-white mb-4"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(36px, 8vw, 64px)",
            letterSpacing: "0.04em",
          }}
        >
          {title.toUpperCase()}
        </h1>
        <p className="text-[#555] text-base leading-relaxed mb-10">
          {description}
        </p>
        <Link href="/game" className="btn-secondary px-8 py-3 inline-flex">
          ← Back to HQ
        </Link>
      </div>
    </div>
  );
}
