import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{ setup?: string }>;
};

export const instant = false;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <LoginForm missingSetup={params.setup === "supabase"} />
    </main>
  );
}
