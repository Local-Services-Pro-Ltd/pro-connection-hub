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
import type { TemplateEntry } from "./registry";

export type VettingOutcome = "featured" | "unfeatured" | "rejected" | "approved";

interface Props {
  company?: string;
  contactName?: string;
  outcome?: VettingOutcome;
  reason?: string;
  profileUrl?: string;
}

const COPY: Record<VettingOutcome, { heading: string; body: string }> = {
  featured: {
    heading: "You're now featured on TradesmanFinder",
    body: "Your checks passed and an admin has featured your firm on our homepage. Homeowners in your area will see your profile first.",
  },
  unfeatured: {
    heading: "Your firm is no longer featured",
    body: "We've taken your firm off the homepage feature slot for now. Your listing stays live and you'll keep receiving job leads as normal.",
  },
  rejected: {
    heading: "We can't feature your firm yet",
    body: "Your vetting didn't pass this round, so we haven't featured your firm. You can fix the points below and we'll look again.",
  },
  approved: {
    heading: "Your vetting checks have passed",
    body: "Your listing is approved and published. Featuring on the homepage is decided separately by an admin.",
  },
};

const Email = ({
  company = "your firm",
  contactName,
  outcome = "approved",
  reason,
  profileUrl,
}: Props) => {
  const copy = COPY[outcome] ?? COPY.approved;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`${copy.heading} — ${company}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER · VETTING</Text>
          <Heading style={heading}>{copy.heading}</Heading>
          <Text style={text}>
            {contactName ? `Hi ${contactName},` : "Hello,"}
          </Text>
          <Text style={text}>{copy.body}</Text>
          <Text style={text}>
            <strong>Firm:</strong> {company}
          </Text>
          {reason ? (
            <>
              <Hr style={rule} />
              <Text style={text}>
                <strong>Notes from the reviewer</strong>
                <br />
                {reason}
              </Text>
            </>
          ) : null}
          {profileUrl ? (
            <Button style={button} href={profileUrl}>
              View your listing
            </Button>
          ) : null}
          <Hr style={rule} />
          <Text style={small}>
            You're receiving this because your firm is listed on
            TradesmanFinder. Reply to this email if anything looks wrong.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = { backgroundColor: "#f5f4f2", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { backgroundColor: "#ffffff", padding: "32px", maxWidth: "560px", margin: "0 auto" };
const eyebrow = { fontSize: "11px", letterSpacing: "2px", color: "#9a8f86", margin: "0 0 8px" };
const heading = { fontSize: "22px", lineHeight: "1.3", color: "#1b1a19", margin: "0 0 16px" };
const text = { fontSize: "15px", lineHeight: "1.6", color: "#333130" };
const small = { fontSize: "12px", lineHeight: "1.6", color: "#7c7570" };
const rule = { borderColor: "#e7e3df", margin: "24px 0" };
const button = {
  backgroundColor: "#c2410c",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "4px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};

export const template: TemplateEntry = {
  component: Email,
  displayName: "Pro vetting status",
  subject: (data) =>
    (COPY[(data['outcome'] as VettingOutcome) ?? "approved"] ?? COPY.approved)
      .heading,
  previewData: {
    company: "Ember Building Ltd",
    contactName: "Sam",
    outcome: "featured",
    profileUrl: "https://tradesmanfinder.org/pro/example",
  },
};

export default Email;
