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
  reference?: string;
  jobReference?: string;
  category?: string;
  description?: string;
  desiredOutcome?: string;
}

const Email = ({
  company,
  reference,
  jobReference,
  category,
  description,
  desiredOutcome,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      A homeowner has reported a problem with job {jobReference ?? ""}. Please respond.
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>A problem has been reported</Heading>
        <Text style={text}>
          A homeowner has reported a problem with a job {company} took on through TradesmanFinder.
          We have not made any decision. We would like to hear your side first.
        </Text>
        <Text style={item}>Our reference: {reference}</Text>
        <Text style={item}>Job: {jobReference}</Text>
        <Text style={item}>What they say went wrong: {category}</Text>
        <Text style={text}>In their words:</Text>
        <Text style={quote}>{description}</Text>
        {desiredOutcome ? (
          <>
            <Text style={text}>What they would like to happen:</Text>
            <Text style={quote}>{desiredOutcome}</Text>
          </>
        ) : null}
        <Hr style={rule} />
        <Text style={text}>
          Please reply to this email within 5 working days with your account of what happened and
          anything that supports it, such as the quote, messages or photos.
        </Text>
        <Text style={small}>
          After hearing from both sides we may record the matter, issue a warning, suspend a listing
          or remove it. We will tell you what we decide and why.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Please respond: problem reported with job ${(data["jobReference"] as string) ?? ""}`.trim(),
  displayName: "Complaint — firm asked to respond",
  previewData: {
    company: "Smith Plumbing",
    reference: "TFR-1A2B3C4D",
    jobReference: "E704189A",
    category: "The work was started and not finished",
    description: "The tap was removed on Monday and nobody has been back since.",
    desiredOutcome: "For the job to be finished this week.",
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
