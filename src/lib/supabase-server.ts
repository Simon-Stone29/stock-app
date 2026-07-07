import { createClient } from "@supabase/supabase-js";
import { WebSocket } from "ws";

export function createSupabaseServerClient(url: string | undefined, key: string | undefined) {
  return createClient(url!, key!, {
    realtime: {
      transport: WebSocket as any,
    },
  });
}
