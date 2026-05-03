import { NextRequest, NextResponse } from "next/server";
import { register, createSession, COOKIE_CONFIG } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, email, password, brand_name } = body;

  if (!username || !email || !password || !brand_name) {
    return NextResponse.json(
      { success: false, error: "All fields are required." },
      { status: 400 }
    );
  }

  const result = await register({ username, email, password, brand_name });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error, debug: process.env.NODE_ENV !== "production" ? result.error : undefined },
      { status: 400 }
    );
  }

  const token = await createSession(result.userId!);
  const response = NextResponse.json({ success: true });
  response.cookies.set({ ...COOKIE_CONFIG, value: token });
  return response;
}
