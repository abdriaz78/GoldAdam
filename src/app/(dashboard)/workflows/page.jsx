"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { PageHeader, Content, SectionHead, Card, Btn, Input, FlagBadge } from "@/components/ui";

export default function WorkflowsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [date, setDate] = useState("");

  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [confirmDate, setConfirmDate] = useState("");
  const [resend, setResend] = useState(false);

  async function send() {
    setLoading(true);
    try {
      const body = date ? { date } : {};
      const res = await api("/api/notifications/send-reminders", { method: "POST", body });
      setResult(res);
      toast.success(`Reminders processed: ${res.sentCount || 0}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendConfirmations() {
    setConfirmLoading(true);
    try {
      const body = { ...(confirmDate ? { date: confirmDate } : {}), resend };
      const res = await api("/api/notifications/send-confirmations", { method: "POST", body });
      setConfirmResult(res);
      toast.success(`Confirmation texts sent: ${res.sentCount || 0}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Confirmation Workflows" subtitle="How the SMS confirmation loop runs, plus the two manual triggers" />
      <Content>
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="rounded-xl border border-border bg-[#12161D] p-6">
            <SectionHead title="How it works" subtitle="Runs automatically via Vercel Cron / Twilio webhook" />
            <div className="mx-auto flex max-w-md flex-col items-center gap-0">
              <WfStep kind="1 · TRIGGER">New pending appointment — scraped or created</WfStep>
              <Connector />
              <WfStep kind="2 · ACTION — SMS">
                Send confirmation request: &ldquo;Hi {"{client_name}"}, confirm your Gold Adam appointment{" "}
                {"{date}"} at {"{time}"}? Reply YES or a new time.&rdquo;
              </WfStep>
              <Connector />
              <WfStep kind="3 · INBOUND">Customer reply lands on the Twilio webhook</WfStep>
              <Connector />
              <WfStep kind="4 · BRANCH">YES → Confirmed · New time → note added · CANCEL → Canceled</WfStep>
              <Connector />
              <WfStep kind="5 · ACTION">Update status + write-back queued to goldadam</WfStep>
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <SectionHead title="Send reminders" subtitle="To agents" />
              <label className="mb-1 block text-[11.5px] text-muted">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full" />
              <p className="mt-2 text-xs text-muted-dim">Leave blank to send reminders for tomorrow.</p>
              <Btn variant="gold" disabled={loading} onClick={send} className="mt-3 w-full">
                {loading ? "Sending…" : "Send reminders"}
              </Btn>
              {result && (
                <div className="mt-3 rounded-lg border border-border bg-[#161C25] p-3 text-xs text-muted">
                  Sent reminders for {result.date}. {result.sentCount || 0} sent.
                </div>
              )}
            </Card>

            <Card>
              <SectionHead title="Send confirmation texts" subtitle="To customers" />
              <label className="mb-1 block text-[11.5px] text-muted">Date</label>
              <Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} className="w-full" />
              <label className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
                <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} className="accent-gold" />
                Resend to already-texted bookings
              </label>
              <Btn variant="gold" disabled={confirmLoading} onClick={sendConfirmations} className="mt-3 w-full">
                {confirmLoading ? "Sending…" : "Send confirmation texts"}
              </Btn>
              {confirmResult && (
                <div className="mt-3 rounded-lg border border-border bg-[#161C25] p-3 text-xs text-muted">
                  Sent confirmation texts for {confirmResult.date}. {confirmResult.sentCount || 0} sent.
                </div>
              )}
            </Card>
          </div>
        </div>

        <div>
          <SectionHead title="In-progress threads" subtitle="Preview — wire to the SMS message log to make this live" />
          <Card>
            <div className="flex items-center gap-2 text-[12.5px] text-muted-dim">
              <FlagBadge tone="neutral">Not wired yet</FlagBadge>
              Thread-by-thread status (replied / waiting) needs a persisted message log keyed by booking — the
              Twilio webhook currently only updates booking status, it doesn&apos;t store the conversation.
            </div>
          </Card>
        </div>
      </Content>
    </>
  );
}

function WfStep({ kind, children }) {
  return (
    <div className="w-full rounded-lg border border-border bg-panel px-4 py-3.5 text-[12.5px] text-text">
      <div className="mb-1 text-[10.5px] font-semibold text-gold">{kind}</div>
      {children}
    </div>
  );
}

function Connector() {
  return <div className="h-5 w-px bg-border" />;
}
