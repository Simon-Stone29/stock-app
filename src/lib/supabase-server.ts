import { createClient } from "@supabase/supabase-js";

const WebSocketTransport = globalThis.WebSocket as any;

export function createSupabaseServerClient(url: string | undefined, key: string | undefined) {
  return createClient(url!, key!, {
    realtime: {
      transport: WebSocketTransport,
    },
  });
}
