import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export async function serverClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(values) {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        },
      },
    },
  );
}
