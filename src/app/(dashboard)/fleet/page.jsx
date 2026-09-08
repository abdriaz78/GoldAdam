"use client";

import { PageHeader, Content, Card, FlagBadge } from "@/components/ui";

// NOTE: No Fleet/Van data model exists yet — sample data only, so the page
// layout can be reviewed. Wiring this up needs a Van collection (route,
// mileage, service interval) and something to update mileage (manual entry,
// or read from the routes/assignments the van is linked to).
const VANS = [
  { plate: "Route 2 — Van 04", miles: "62,340 mi", note: "Next service in 660 mi", pct: 82, tone: "gold" },
  { plate: "Route 4 — Van 07", miles: "88,110 mi", note: "Overdue by 340 mi", pct: 100, tone: "red" },
  { plate: "Route 7 — Van 02", miles: "31,900 mi", note: "Next service in 4,100 mi", pct: 38, tone: "gold" },
];

export default function FleetPage() {
  return (
    <>
      <PageHeader title="Fleet" subtitle="Vans by route">
        <FlagBadge tone="neutral">Sample data — needs a Van data model</FlagBadge>
      </PageHeader>
      <Content>
        <div className="grid gap-4 md:grid-cols-3">
          {VANS.map((v) => (
            <Card key={v.plate}>
              <div className="font-serif text-[17px] font-semibold text-text">{v.plate}</div>
              <div className="mt-1.5 text-xs text-muted">
                {v.miles} · {v.note}
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded bg-panel-raised">
                <div className={v.tone === "red" ? "h-full bg-red" : "h-full bg-gold"} style={{ width: `${v.pct}%` }} />
              </div>
            </Card>
          ))}
        </div>
      </Content>
    </>
  );
}
