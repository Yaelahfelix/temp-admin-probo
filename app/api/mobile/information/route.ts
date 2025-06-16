import { client } from "@/sanity/lib/client";
import { groq } from "next-sanity";
import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";
import { verifyApiSecret } from "@/lib/verifyApiSecret";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyApiSecret(request.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const query = groq`
      *[_type == "information" && expired_at > now()] | order(_createdAt desc) {
  _id,
  title,
  description,
  "image": image.asset->url,   
  expired_at,
  _createdAt
}
      `;

    const information = await client.fetch(query);
    return NextResponse.json({ information });
  } catch (error) {
    console.error("Error fetching information:", error);
    return NextResponse.json(
      { error: "Error fetching information" },
      { status: 500 }
    );
  }
}
