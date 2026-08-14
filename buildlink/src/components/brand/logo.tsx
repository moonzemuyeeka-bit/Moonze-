import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * BuildLink wordmark.
 *
 * Inline SVG rather than an image file: it is a handful of bytes, scales
 * perfectly on any screen and needs no extra network request on a slow mobile
 * connection. The mark is two linked building blocks.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-hidden
      className={cn("size-8", className)}
      fill="none"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M8 20.5V11.5C8 10.6716 8.67157 10 9.5 10H14.5C15.3284 10 16 10.6716 16 11.5V13.5"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M16 18.5V20.5C16 21.3284 16.6716 22 17.5 22H22.5C23.3284 22 24 21.3284 24 20.5V11.5C24 10.6716 23.3284 10 22.5 10H17.5"
        stroke="#FFA938"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="10.5" y="15.5" width="5" height="5" rx="1" fill="white" opacity="0.85" />
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  showTagline = false,
  size = "md",
}: {
  href?: string | null;
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark
        className={cn(
          "text-brand-700",
          size === "sm" && "size-7",
          size === "md" && "size-8",
          size === "lg" && "size-10",
        )}
      />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            size === "sm" && "text-base",
            size === "md" && "text-lg",
            size === "lg" && "text-2xl",
          )}
        >
          BuildLink
          <span className="text-brand-600"> Zambia</span>
        </span>
        {showTagline ? (
          <span className="mt-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-foreground-subtle">
            Build better. Buy smarter.
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="inline-flex rounded-md" aria-label="BuildLink Zambia home">
      {content}
    </Link>
  );
}
