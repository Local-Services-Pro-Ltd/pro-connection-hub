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
import { BrandFooter, BrandHeader } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  company?: string;
  label?: string;
  expiresOn?: string;
  daysLeft?: number;
  expired?: boolean;
  dashboardUrl?: string;
}

const Email = ({ company, label, expiresOn, daysLeft, expired, dashboardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {expired
        ? `Your ${label ?? "document"} has expired`
        : `Your ${label ?? "document"} expires in ${daysLeft ?? ""} days`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>
          {expired ? `Your ${label} has expired` : `Your ${label} expires soon`}
        </Heading>
        <Text style={item}>Firm: {company}</Text>
        <Text style={item}>
          {expired ? "Expired on" : "Expires on"}: <strong>{expiresOn}</strong>
        </Text>
        <Text style={text}>
          {expired
            ? "Your profile now shows this as expired, and homeowners cannot invite you to quote until we have checked the renewal."
            : `That is ${daysLeft} days away. Once it passes, your profile will show it as expired and homeowners will not be able to invite you to quote.`}
        </Text>
        <Text style={text}>
          Send us the renewal from the Documents tab in your dashboard. It takes a minute, and we
          check it as soon as we can.
        </Text>
        {dashboardUrl ? (
          <Button style={button} href={dashboardUrl}>
            Send your renewal
          </Button>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          Already renewed? Upload the new certificate with its new expiry date and this reminder
          stops.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data["expired"]
      ? `Your ${(data["label"] as string) || "document"} has expired`
      : `Your ${(data["label"] as string) || "document"} expires in ${data["daysLeft"] ?? ""} days`,
  displayName: "Firm document — expiry reminder",
  previewData: {
    company: "Smith Plumbing",
    label: "Public liability insurance",
    expiresOn: "25 December 2026",
    daysLeft: 30,
    expired: false,
    dashboardUrl: "https://tradesmanfinder.org/dashboard",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const heading = { fontSize: "24px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
const item = { ...text, margin: "0 0 6px" };
const quote = { ...text, borderLeft: "3px solid #e5e7eb", paddingLeft: "12px" };
const small = { fontSize: "13px", lineHeight: "21px", color: "#6b7280" };
const button = {
  backgroundColor: "#c2410c",
  color: "#ffffff",
  borderRadius: "6px",
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  margin: "18px 0",
};
const rule = { borderColor: "#e5e7eb", margin: "24px 0" };
