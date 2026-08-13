import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <SignIn />
    </div>
  );
}
