import { NotificationsManager } from "@/components/notifications/notification-center";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function NotificationsPage() {
  const supabase = await createClient();
  const result = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  return (
    <NotificationsManager
      initialNotifications={result.data ?? []}
      queryError={result.error ? `Não foi possível carregar as notificações: ${result.error.message}` : null}
    />
  );
}
