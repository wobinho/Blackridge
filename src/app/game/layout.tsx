import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import GameNav from "@/components/GameNav";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  return (
    <div className="min-h-dvh bg-[#080808] flex flex-col">
      <GameNav user={session} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
