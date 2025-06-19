// /app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generateSessionToken } from "@/lib/session";
import db from "@/lib/db";
import { MobileUser } from "@/types/mobile";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { checkSessionUserId, getUserFromEmail } from "@/app/api/mobile/utlis";

// Konstanta OAuth Google
const GOOGLE_CLIENT_ID = process.env.MOBILE_GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.MOBILE_GOOGLE_CLIENT_SECRET!;
const GOOGLE_ACCESS_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const BASE_URL = process.env.BASE_URL!;
const URL_REDIRECT_MOBILE = process.env.URL_REDIRECT_MOBILE!; // URL untuk redirect ke mobile app

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  sub: string;
  picture: string;
  email_verified: boolean;
}

interface Session {
  id: string;
  userId: number;
  expiresAt: Date;
}

async function createSession(token: string, userId: number): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 hari
  };

  await db.execute(
    "INSERT INTO session_user (id, userid, expires_at) VALUES (?, ?, ?)",
    [session.id, session.userId, session.expiresAt]
  );

  return session;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return NextResponse.json(
        { success: false, message: "Authorization code not found" },
        { status: 400 }
      );
    }

    // Data untuk exchange authorization code dengan access token
    const tokenData = {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: `${BASE_URL}/api/mobile/auth/google/callback`,
      grant_type: "authorization_code",
    };

    const tokenResponse = await fetch(GOOGLE_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tokenData),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for tokens");
    }

    const tokenResult: GoogleTokenResponse = await tokenResponse.json();
    const { id_token } = tokenResult;

    const userInfoResponse = await fetch(
      `${GOOGLE_TOKEN_INFO_URL}?id_token=${id_token}`
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to verify ID token");
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();
    const { email, name, sub, picture } = userInfo;

    const existingUser = await getUserFromEmail(email);

    let userId: number;
    let session: any;

    if (!existingUser) {
      const [insertResult]: any = await db.execute(
        `INSERT INTO web_public_user (email, nama, password, provider, provider_id, image, alamat) 
         VALUES (?, ?, '', 'google', ?, ?, '')`,
        [email, name, sub, picture]
      );

      userId = insertResult.insertId;
      const sessionToken = generateSessionToken();
      const newSession = await createSession(sessionToken, userId);

      session = {
        session: { ...newSession, token: sessionToken },
        user: {
          id: userId,
          nama: name,
          email: email,
          alamat: "",
          nomor_telepon: "",
          image: picture,
        },
      };
    } else {
      // User sudah ada
      userId = existingUser.id as any;

      const sessionToken = generateSessionToken();
      const newSession = await createSession(sessionToken, userId);

      session = {
        session: { ...newSession, token: sessionToken },
        user: {
          id: userId,
          nama: name,
          email: email,
          alamat: existingUser.alamat || "",
          nomor_telepon: existingUser.nomor_telepon || "",
          image: picture,
        },
      };
    }

    const redirectUrl = `${URL_REDIRECT_MOBILE}?token=${session.session.token}&nama=${encodeURIComponent(session.user.nama)}&email=${encodeURIComponent(session.user.email)}`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Authentication failed",
      },
      { status: 500 }
    );
  }
}
