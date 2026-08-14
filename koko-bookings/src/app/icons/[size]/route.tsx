import { ImageResponse } from "next/og";

/** App icons for the web manifest, rendered on demand at the requested size. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await params;
  const size = Math.min(1024, Math.max(48, Number(rawSize) || 192));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #de6b8e 0%, #a34364 100%)",
          color: "#fffcfd",
          fontSize: size * 0.52,
          fontWeight: 700,
          fontFamily: "Georgia, serif",
          letterSpacing: -2,
        }}
      >
        K
      </div>
    ),
    { width: size, height: size },
  );
}
