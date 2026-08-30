import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface Props {
  company?: string;
  contactName?: string;
  reference?: string;
  kind?: string;
  detail?: string;
  statusUrl?: string;
}

const HEADLINES: Record<string, string> = {
  documents_pending: "We're still waiting on your paperwork.",
  document_rejected: "One of your documents needs replacing.",
  insurance_expiring: "Your insurance cover is about to run out.",
  insurance_expired: "Your insurance cover has expired.",
};

const BODIES: Record<string, string> = {
  documents_pending:
    "We can't finish your certification checks until the required paperwork is on file. It takes a couple of minutes from your tracking page.",
  document_rejected:
    "Our reviewer couldn't accept one of the files you sent. Replace it from your tracking page and we'll pick the review straight back up.",
  insurance_expiring:
    "Certified firms need live public liability cover. Send us the renewed certificate before the current one lapses so your status doesn't drop.",
  insurance_expired:
    "Our records show your public liability cover has lapsed. Send us renewed cover from your tracking page to keep your certification on track.",
};

const Email = ({
  company,
  contactName,
  reference,
  kind,
  detail,
  statusUrl,
}: Props) => {
  const key = kind ?? "documents_pending";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${HEADLINES[key] ?? "Certification reminder"} (${reference ?? ""})`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER</Text>
          <Heading style={heading}>
            {HEADLINES[key] ?? "Certification reminder"}
          </Heading>
          <Text style={text}>
            {contactName ? `Hi ${contactName},` : "Hi there,"}
          </Text>
          <Text style={text}>{BODIES[key] ?? BODIES["documents_pending"]}</Text>
          <Text style={text}>
            {`Firm: ${company ?? "—"}`}
            <br />
            {`Reference: ${reference ?? "—"}`}
          </Text>
          {detail ? <Text style={note}>{detail}</Text> : null}
          {statusUrl ? (
            <Button style={button} href={statusUrl}>
              Open your application
            </Button>
          ) : null}
          <Hr style={hr} />
          <Text style={small}>
            You're getting this because your firm has an open TradesmanFinder
            certification application.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#0f1113",
  fontFamily: "Helvetica, Arial, sans-serif",
};
const container = {
  margin: "0 auto",
  padding: "32px 28px",
  maxWidth: "560px",
  backgroundColor: "#17191c",
  borderRadius: "10px",
};
const eyebrow = {
  color: "#e2703a",
  fontSize: "11px",
  letterSpacing: "2px",
  margin: "0 0 12px",
};
const heading = { color: "#f5f4f2", fontSize: "24px", margin: "0 0 16px" };
const text = { color: "#cfcdc9", fontSize: "15px", lineHeight: "24px" };
const note = {
  color: "#f5f4f2",
  fontSize: "15px",
  lineHeight: "24px",
  backgroundColor: "#1f2226",
  borderLeft: "3px solid #e2703a",
  padding: "12px 16px",
};
const small = { color: "#8b8885", fontSize: "12px", lineHeight: "18px" };
const hr = { borderColor: "#2a2d31", margin: "28px 0 16px" };
const button = {
  backgroundColor: "#e2703a",
  borderRadius: "6px",
  color: "#12100e",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) => {
    const kind = String(data["kind"] ?? "documents_pending");
    const ref = String(data["reference"] ?? "");
    const label =
      kind === "document_rejected"
        ? "A document needs replacing"
        : kind === "insurance_expiring"
          ? "Your insurance cover expires soon"
          : kind === "insurance_expired"
            ? "Your insurance cover has expired"
            : "We're waiting on your paperwork";
    return ref ? `${label} (${ref})` : label;
  },
  displayName: "Certification reminder",
  previewData: {
    company: "Ember Plumbing Ltd",
    contactName: "Sam",
    reference: "TFC-1A2B3C4D",
    kind: "documents_pending",
    detail: "Still missing: Public liability insurance, Company registration.",
    statusUrl: "https://tradesmanfinder.org/application-status?token=demo",
  },
};
