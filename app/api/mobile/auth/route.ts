import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { generateSessionToken, Session } from "@/lib/session"; // sesuaikan path
import { UserGet } from "@/lib/server/user";
import db from "@/lib/db";
import { MobileUser } from "@/types/mobile";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";

async function getUserFromEmail(email: string): Promise<MobileUser | null> {
  const [data]: any = await db.query(
    "SELECT a.id, a.email,a.nama,a.image,a.password, a.alamat FROM web_public_user a WHERE a.email = ?",
    email
  );
  if (data.length === 0) {
    return null;
  }

  const user: MobileUser = {
    id: data[0].id,
    email: data[0].email,
    nama: data[0].nama,
    image: data[0].image,
    alamat: data[0].alamat,
    password: data[0].password,
  };
  return user;
}

export async function createSession(
  token: string,
  userId: number
): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  };
  await db.execute(
    "INSERT INTO session_user (id, userid, expires_at) VALUES (?, ?, ?)",
    [session.id, session.userId, session.expiresAt]
  );
  return session;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { message: "Invalid or missing fields" },
        { status: 400 }
      );
    }

    if (email === "" || password === "") {
      return NextResponse.json(
        { message: "Please enter your email and password." },
        { status: 400 }
      );
    }

    const user = await getUserFromEmail(email);
    if (!user) {
      return NextResponse.json(
        { message: "Account does not exist" },
        { status: 404 }
      );
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return NextResponse.json(
        { message: "Invalid password" },
        { status: 401 }
      );
    }

    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, user.id);

    return NextResponse.json({
      message: "Login successful",
      token: sessionToken,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.nama,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
