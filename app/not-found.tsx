// app/not-found.tsx
"use client";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <Link href="/" className="h-full w-full flex items-center justify-center">
      <img src="/Page_Not_Found.png" alt="Page Not Found" className="h-1/2" />
      </Link>
      
    </div>
  );
}
