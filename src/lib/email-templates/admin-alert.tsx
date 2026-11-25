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
  subject?: string;
  intro?: string;
  lines?: string[];
  actionUrl?: string;
  actionLabel?: string;
}

const Email = ({ subject, intro, lines, actionUrl, actionLabel }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{subject ?? "Something is waiting for you on TradesmanFinder"}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>{subject}</Heading>
        {intro ? <Text style={text}>{intro}</Text> : null}
        {(lines ?? []).map((line) => (
          <Text key={line} style={item}>
            {line}
          </Text>
        ))}
        {actionUrl ? (
          <Button style={button} href={actionUrl}>
            {actionLabel ?? "Open the admin area"}
          </Button>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          You are getting this because your account is a TradesmanFinder admin. Sign in with your
          admin account to open the link.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    (data["subject"] as string) || "Something is waiting for you on TradesmanFinder",
  displayName: "Admin — something needs attention",
  previewData: {
    subject: "New firm application: Smith Plumbing",
    intro: "A firm has applied to join and is waiting for review.",
    lines: ["Trade: Plumber", "Area: Kent", "Reference: TFC-12345678"],
    actionUrl: "https://tradesmanfinder.org/admin/applications",
    actionLabel: "Review applications",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const heading = { fontSize: "24px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
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
const item = { ...text, margin: "0 0 6px", paddingLeft: "12px", borderLeft: "3px solid #F97316" };
