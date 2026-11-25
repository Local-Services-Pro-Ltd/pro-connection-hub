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
  verified?: boolean;
  note?: string;
  expiresOn?: string | null;
  dashboardUrl?: string;
}

const Email = ({ company, label, verified, note, expiresOn, dashboardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {verified
        ? `We have checked your ${label ?? "document"}`
        : `Your ${label ?? "document"} needs attention`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>
          {verified ? "Your document has been checked" : "Your document needs attention"}
        </Heading>
        <Text style={item}>Firm: {company}</Text>
        <Text style={item}>Document: {label}</Text>
        {verified ? (
          <>
            {expiresOn ? <Text style={item}>Valid until: {expiresOn}</Text> : null}
            <Text style={text}>
              It now shows as checked on your profile, with the date we checked it. If it is your
              public liability insurance, homeowners can now invite you to quote.
            </Text>
          </>
        ) : (
          <>
            <Text style={text}>We couldn't mark this as checked yet. Here is why:</Text>
            <Text style={quote}>{note}</Text>
            <Text style={text}>
              Please send it again from the Documents tab in your dashboard once you have put this
              right.
            </Text>
          </>
        )}
        {dashboardUrl ? (
          <Button style={button} href={dashboardUrl}>
            Open your dashboard
          </Button>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          Questions? Reply to hello@tradesmanfinder.org and a person will get back to you.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data["verified"]
      ? `We have checked your ${(data["label"] as string) || "document"}`
      : `Your ${(data["label"] as string) || "document"} needs attention`,
  displayName: "Firm document — checked or sent back",
  previewData: {
    company: "Smith Plumbing",
    label: "Public liability insurance",
    verified: true,
    expiresOn: "2027-06-30",
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
