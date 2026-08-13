import { Card, Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="anim-fade" style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px 40px" }}>
      <Skeleton w={140} h={22} style={{ marginBottom: 18 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} style={{ padding: 16 }}>
            <Skeleton w={70} h={10} style={{ marginBottom: 10 }} />
            <Skeleton w={90} h={22} />
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        <Card style={{ padding: 18 }}><Skeleton h={180} /></Card>
        <Card style={{ padding: 18 }}><Skeleton h={180} /></Card>
      </div>
    </div>
  );
}
