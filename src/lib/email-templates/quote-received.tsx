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
  contactName?: string;
  company?: string;
  reference?: string;
  title?: string;
  jobUrl?: string;
}

const Email = ({ contactName, company, reference, title, jobUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {company ?? "A firm"} has sent a quote for your job {reference ?? ""}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>You have a quote from {company}</Heading>
        <Text style={text}>
          {contactName ? `Hello ${contactName},` : "Hello,"} {company} has sent a quote for your
          job.
        </Text>
        <Text style={item}>Reference: {reference}</Text>
        {title ? <Text style={item}>Job: {title}</Text> : null}
        {jobUrl ? (
          <Button style={button} href={jobUrl}>
            See and compare your quotes
          </Button>
        ) : null}
        <Text style={text}>
          Every quote shows labour, materials, VAT, dates, warranty, payment schedule and what is
          not included, in the same order, so you can compare them side by side.
        </Text>
        <Hr style={rule} />
        <Text style={small}>
          A quote is the firm's offer to you. Your agreement is with the firm, not with
          TradesmanFinder. Ask for it in writing before work starts. This link is private to you, so
          please don't forward it.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `${(data["company"] as string) || "A firm"} has sent a quote for your job ${(data["reference"] as string) ?? ""}`.trim(),
  displayName: "Quote — homeowner received a quote",
  previewData: {
    contactName: "Alex",
    company: "Smith Plumbing",
    reference: "E704189A",
    title: "Replace a leaking kitchen tap",
    jobUrl: "https://tradesmanfinder.org/job-status?t=example",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const heading = { fontSize: "24px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
const item = { ...text, margin: "0 0 6px" };
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
