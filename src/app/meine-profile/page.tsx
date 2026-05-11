import { redirect } from "next/navigation"

export default function MeineProfilePage() {
  redirect("/ressourcen?tab=profile")
}