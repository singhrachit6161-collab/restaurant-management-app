import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ROLE_HOME: Record<string, string> = {
  OWNER: "/dashboard",
  MANAGER: "/dashboard",
  CASHIER: "/pos",
  WAITER: "/waiter",
  CHEF: "/kitchen",
};

function isAllowed(role: string, pathname: string) {
  if (role === "OWNER" || role === "MANAGER") return true;
  if (role === "CASHIER") return pathname.startsWith("/pos");
  if (role === "WAITER") return pathname.startsWith("/waiter");
  if (role === "CHEF") return pathname.startsWith("/kitchen");
  return false;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const protectedPrefixes = ["/dashboard", "/pos", "/waiter", "/kitchen"];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (!isProtected) return NextResponse.next();

  if (!session?.user) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAllowed(session.user.role, pathname)) {
    const home = ROLE_HOME[session.user.role] ?? "/login";
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/pos/:path*", "/waiter/:path*", "/kitchen/:path*"],
};
