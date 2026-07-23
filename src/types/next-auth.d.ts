import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    restaurantId?: string;
    accountId?: string;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      restaurantId: string;
      accountId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    restaurantId?: string;
    accountId?: string;
  }
}
