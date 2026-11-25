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
  reference?: string;
  proName?: string;
  company?: string;
  trade?: string;
  vettingStatus?: string;
  profileUrl?: string;
  message?: string | null;
  jobUrl?: string;
}

const Email = ({
  reference,
  proName,
  company,
  trade,
  vettingStatus,
  profileUrl,
  message,
  jobUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A local firm is interested in your job {reference ?? ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>A local firm is interested in your job {reference}</Heading>
        <Text style={text}>
          <strong>{proName}</strong> from <strong>{company}</strong> is interested in your job.
        </Text>
        <Text style={text}>Trade: {trade}</Text>
        <Text style={text}>Status: {vettingStatus}</Text>
        {message ? <Text style={quoteStyle}>{message}</Text> : null}
        {profileUrl ? (
          <Button style={button} href={profileUrl}>
            View {company}'s profile
          </Button>
        ) : null}
        <Hr style={rule} />
        <Text style={text}>
          They don't have your contact details. If you'd like a quote, contact them from their
          profile — only firms you contact get your details.
        </Text>
        {jobUrl ? (
          <Text style={text}>
            <a href={jobUrl}>See your job and every firm that is interested</a>. That page is
            private to you, so please don't forward this email.
          </Text>
        ) : null}
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `A local firm is interested in your job ${(data["reference"] as string) ?? ""}`,
  displayName: "Job — firm interested",
  previewData: {
    reference: "JOB-123456",
    proName: "Alex Smith",
    company: "Smith Plumbing",
    trade: "Plumber",
    vettingStatus: "Vetting in progress",
    profileUrl: "https://tradesmanfinder.org/pro/smith-plumbing",
    message: "I cover this area and have experience with this type of repair.",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = { fontSize: "11px", letterSpacing: "2px", color: "#c2410c", margin: "0 0 6px" };
const heading = { fontSize: "24px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
const quoteStyle = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  borderLeft: "3px solid #e5e7eb",
  paddingLeft: "12px",
};
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
