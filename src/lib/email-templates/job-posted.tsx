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
  reference?: string;
  title?: string;
  trade?: string;
  postcode?: string;
  jobUrl?: string;
}

const Email = ({ contactName, reference, title, trade, postcode, jobUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We have your job {reference ?? ""} — keep this email to check on it</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>We have your job</Heading>
        <Text style={text}>
          {contactName ? `Hello ${contactName},` : "Hello,"} thank you for posting your job on
          TradesmanFinder.
        </Text>
        <Text style={item}>
          Reference: <strong>{reference}</strong>
        </Text>
        {title ? <Text style={item}>Job: {title}</Text> : null}
        {trade ? <Text style={item}>Trade: {trade}</Text> : null}
        {postcode ? <Text style={item}>Postcode: {postcode}</Text> : null}
        {jobUrl ? (
          <Button style={button} href={jobUrl}>
            See your job and matched firms
          </Button>
        ) : null}
        <Text style={text}>
          That page is private to you. It shows the local firms we have matched to your job and any
          firm that has said it is interested. You don't need an account or a password.
        </Text>
        <Hr style={rule} />
        <Text style={text}>
          Firms can see what the job is and the first half of your postcode. They can't see your
          name, email address or full postcode. Only firms you choose to contact get your details.
        </Text>
        <Text style={small}>
          Keep this email: anyone with the link above can see your job, so please don't forward it.
          If you didn't post this job, reply to hello@tradesmanfinder.org and we will remove it.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `We have your job ${(data["reference"] as string) ?? ""}`.trim(),
  displayName: "Job — posted confirmation",
  previewData: {
    contactName: "Alex",
    reference: "JOB-123456",
    title: "Replace a leaking kitchen tap",
    trade: "Plumber",
    postcode: "ME14 1AA",
    jobUrl: "https://tradesmanfinder.org/job-status?t=example",
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
const item = { ...text, margin: "0 0 6px" };
