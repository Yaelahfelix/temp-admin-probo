// /app/api/auth/google/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyApiSecret } from "@/lib/verifyApiSecret";
import crypto from "crypto";

// Konstanta OAuth Google - sesuaikan dengan environment variables Anda
const GOOGLE_CLIENT_ID = process.env.MOBILE_GOOGLE_CLIENT_ID!;
const GOOGLE_CALLBACK_URL = `${process.env.BASE_URL}/api/mobile/auth/google/callback`; // contoh: http://localhost:3000/api/auth/google/callback
const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_SCOPES = ["openid", "email", "profile"];

export async function GET(req: NextRequest) {
  try {
    // if (!verifyApiSecret(req.headers)) {
    //   return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    // }

    const state = crypto.randomUUID();

    const scopes = GOOGLE_OAUTH_SCOPES.join(" ");

    const GOOGLE_OAUTH_CONSENT_SCREEN_URL = `${GOOGLE_OAUTH_URL}?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_CALLBACK_URL}&access_type=offline&response_type=code&state=${state}&scope=${scopes}`;

    return NextResponse.redirect(GOOGLE_OAUTH_CONSENT_SCREEN_URL);
  } catch (error) {
    console.error("Google OAuth redirect error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
