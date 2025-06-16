import {
  generateSessionToken,
  createSession,
  setSessionTokenCookie,
  getUserFromGoogleLogin,
} from "@/lib/session";
import { google } from "@/lib/utils";
import { cookies } from "next/headers";
import { decodeIdToken } from "arctic";

import type { OAuth2Tokens } from "arctic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value ?? null;
  const codeVerifier = cookieStore.get("google_code_verifier")?.value ?? null;
  if (
    code === null ||
    state === null ||
    storedState === null ||
    codeVerifier === null
  ) {
    return new Response(null, {
      status: 400,
    });
  }
  if (state !== storedState) {
    return new Response(null, {
      status: 400,
    });
  }

  let tokens: OAuth2Tokens;
  try {
    tokens = await google.validateAuthorizationCode(code, codeVerifier);
  } catch (e) {
    // Invalid code or client credentials
    return new Response(null, {
      status: 400,
    });
  }
  const claims: any = decodeIdToken(tokens.idToken());
  const googleUserId = claims.sub;
  const email = claims.email;
  console.log(claims);

  // TODO: Replace this with your own DB query.
  const existingUser = await getUserFromGoogleLogin(email);

  if (existingUser !== null) {
    const sessionToken = generateSessionToken();
    const session = await createSession(sessionToken, existingUser.id);
    await setSessionTokenCookie(sessionToken, session.expiresAt);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login?state=0",
    },
  });
  // // TODO: Replace this with your own DB query.
  // const user = await createUser(googleUserId, username);

  // const sessionToken = generateSessionToken();
  // const session = await createSession(sessionToken, user.id);
  // await setSessionTokenCookie(sessionToken, session.expiresAt);
  // return new Response(null, {
  // 	status: 302,
  // 	headers: {
  // 		Location: "/"
  // 	}
  // });
}
