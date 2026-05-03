import { NextRequest, NextResponse } from "next/server";
import { login, COOKIE_CONFIG } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { identifier, password } = body;

  if (!identifier || !password) {
    return NextResponse.json(
      { success: false, error: "Missing credentials." },
      { status: 400 }
    );
  }

  const result = await login(identifier, password);

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...COOKIE_CONFIG, value: result.token! });
  return response;
}
