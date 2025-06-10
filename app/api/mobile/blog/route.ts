import { verifyApiSecret } from "@/lib/verifyApiSecret";
import { client } from "@/sanity/lib/client";
import { groq } from "next-sanity";
import { NextRequest, NextResponse } from "next/server";
import { getUserBySession } from "../utlis";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyApiSecret(request.headers)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const query = groq`
    *[_type == "blog"] | order(_createdAt desc)[0..4] {
   _id,
        name,
        description,
        "slug": slug.current,
        "image": image.asset->url,
_createdAt
} 
      `;

    const posts = await client.fetch(query);
    console.log(posts);
    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { error: "Error fetching posts" },
      { status: 500 }
    );
  }
}
