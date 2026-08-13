import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <SignUp />
    </div>
  );
}
