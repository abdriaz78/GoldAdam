"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { PageHeader, Content, SectionHead, Card, Btn, FlagBadge } from "@/components/ui";

// NOTE: There's no Lead/VCR data model yet — no-shows and reschedules aren't
// captured anywhere but a booking's status. This page renders sample data so
// the UI/IA can be reviewed; wiring it up needs a Lead collection (status,
// source booking, follow-up date, notes) plus something that creates a lead
// automatically when a booking goes to no_show/cancelled.
const SAMPLE_ACTIVE = [
  { name: "R. Okafor", meta: "Route 7 · Reschedule requested", followUp: "Follow up Sep 10" },
  { name: "G. Petrov", meta: "Route 4 · No-show", followUp: "Follow up Sep 5" },
  { name: "L. Anders", meta: "Route 2 · No-show", followUp: "Follow up Sep 6" },
];
const SAMPLE_RESCHEDULED = [
  { name: "F. Dubois", meta: "Route 5 · New booking Sep 8" },
  { name: "S. Kimura", meta: "Route 6 · New booking Sep 9" },
];
const SAMPLE_DEAD = [{ name: "W. Osei", meta: "Route 4 · Unresponsive 14 days" }];

const SAMPLE_DUE_TODAY = [
  { name: "R. Okafor", meta: "Reschedule requested · Aug 28 · 469-555-0134" },
  { name: "L. Anders", meta: "No-show · Aug 30 · 214-555-0122" },
  { name: "G. Petrov", meta: "No-show · Sep 1 · 972-555-0188" },
];
const SAMPLE_UPCOMING = [
  { name: "F. Dubois", meta: "No-show · Aug 25", followUp: "Follow up Sep 6" },
  { name: "S. Kimura", meta: "Reschedule requested · Aug 27", followUp: "Follow up Sep 8" },
];

export default function LeadsPage() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/api/auth/me");
        setMe(res.user);
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, []);

  const isAdmin = me?.role === "admin";

  return (
    <>
      <PageHeader title={isAdmin ? "Leads (VCR)" : "My Leads (VCR)"} subtitle="Recycled bookings — no-shows & reschedules worth another call">
        <FlagBadge tone="neutral">Sample data — needs a Lead data model</FlagBadge>
      </PageHeader>
      <Content>
        {isAdmin ? (
          <div className="grid gap-4 md:grid-cols-3">
            <LeadColumn title="Active" count={SAMPLE_ACTIVE.length} leads={SAMPLE_ACTIVE} />
            <LeadColumn title="Rescheduled" count={SAMPLE_RESCHEDULED.length} leads={SAMPLE_RESCHEDULED} />
            <LeadColumn title="Dead" count={SAMPLE_DEAD.length} leads={SAMPLE_DEAD} dim />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <LeadColumn title="Due today" count={SAMPLE_DUE_TODAY.length} leads={SAMPLE_DUE_TODAY} actions />
            <LeadColumn title="Upcoming follow-ups" count={SAMPLE_UPCOMING.length} leads={SAMPLE_UPCOMING} />
            <div>
              <SectionHead title="Notes history" />
              <Card>
                <div className="mb-1.5 text-xs text-muted">R. Okafor — Aug 30</div>
                <div className="text-[12.5px] text-text">Called, no answer. Left voicemail, will try again Sep 3.</div>
              </Card>
            </div>
          </div>
        )}
      </Content>
    </>
  );
}

function LeadColumn({ title, count, leads, dim, actions }) {
  return (
    <div>
      <div className="mb-2.5 flex justify-between text-xs font-semibold text-muted">
        <span>{title}</span>
        <span>{count}</span>
      </div>
      <div className="space-y-2.5">
        {leads.map((l, i) => (
          <Card key={i} className={dim ? "opacity-55" : undefined}>
            <div className="text-[13px] font-semibold text-text">{l.name}</div>
            <div className="mt-1 text-[11.5px] text-muted-dim">{l.meta}</div>
            {l.followUp && <div className="mt-2 text-[11px] text-gold">{l.followUp}</div>}
            {actions && (
              <div className="mt-2.5 flex gap-1.5">
                <Btn variant="gold" className="!px-2.5 !py-1.5 !text-[11px]">
                  Call
                </Btn>
                <Btn variant="outline" className="!px-2.5 !py-1.5 !text-[11px]">
                  Text
                </Btn>
                <Btn variant="outline" className="!px-2.5 !py-1.5 !text-[11px]">
                  Log note
                </Btn>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
