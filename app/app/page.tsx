import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrionDashboard from "./orion-dashboard";

export default async function OrionAppPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <OrionDashboard userEmail={user.email || "usuário"} />;
}