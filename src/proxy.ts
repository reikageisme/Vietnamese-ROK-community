export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/profile/:path*",
    "/tools/:path*",
    "/forum/:path*",
    "/codex/:path*",
  ],
};
