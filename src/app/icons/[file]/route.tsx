import { ImageResponse } from "next/og";

const SIZES: Record<string, { size: number; maskable: boolean }> = {
  "192.png": { size: 192, maskable: false },
  "512.png": { size: 512, maskable: false },
  "maskable-512.png": { size: 512, maskable: true },
  "apple-180.png": { size: 180, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((file) => ({ file }));
}

/** PWA icons rendered from the logo mark. */
export async function GET(_req: Request, ctx: RouteContext<"/icons/[file]">) {
  const { file } = await ctx.params;
  const spec = SIZES[file];
  if (!spec) return new Response("Not found", { status: 404 });
  const { size, maskable } = spec;
  const inner = maskable ? size * 0.72 : size;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#0a6875" : "transparent",
        }}
      >
        <svg width={inner} height={inner} viewBox="0 0 32 32">
          <rect width="32" height="32" rx={maskable ? 0 : 9} fill="#0a6875" />
          <ellipse cx="16" cy="17" rx="10.5" ry="7.5" fill="#ffffff" opacity="0.22" />
          <path
            d="M11 16.5c1.8-3.4 6.3-4.4 9-2 2.2 2 1.5 5.3-1.4 6.2-2.9.9-7 .5-7.7-1.5-.3-.9-.2-1.8.1-2.7z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
