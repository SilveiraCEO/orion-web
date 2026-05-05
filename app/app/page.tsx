import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrionDashboard from "./orion-dashboard";

export default async function AppPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <OrionDashboard
      userEmail={user.email ?? "Usuário ORION"}
      userId={user.id}
    />
  );
}