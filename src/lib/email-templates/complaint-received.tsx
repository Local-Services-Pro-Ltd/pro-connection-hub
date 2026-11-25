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
  jobReference?: string;
  category?: string;
}

const Email = ({ contactName, reference, jobReference, category }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We have your report {reference ?? ""} and will look into it</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>We have your report</Heading>
        <Text style={text}>
          {contactName ? `Hello ${contactName},` : "Hello,"} thank you for telling us. We are sorry
          something has gone wrong.
        </Text>
        <Text style={item}>
          Your reference: <strong>{reference}</strong>
        </Text>
        <Text style={item}>Job: {jobReference}</Text>
        <Text style={item}>What went wrong: {category}</Text>
        <Hr style={rule} />
        <Text style={text}>What happens next:</Text>
        <Text style={item}>1. We will share your report with the firm and ask it to respond.</Text>
        <Text style={item}>2. We ask the firm to respond within 5 working days.</Text>
        <Text style={item}>3. We will email you what we find and what we have decided.</Text>
        <Text style={text}>
          We can record the problem against the firm, warn it, suspend it or remove it from
          TradesmanFinder. We cannot make a firm redo work or refund you, and we do not guarantee
          any job. Citizens Advice can explain your legal rights: citizensadvice.org.uk.
        </Text>
        <Text style={small}>
          To add anything, reply to hello@tradesmanfinder.org and quote your reference.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `We have your report ${(data["reference"] as string) ?? ""}`.trim(),
  displayName: "Complaint — received (homeowner)",
  previewData: {
    contactName: "Alex",
    reference: "TFR-1A2B3C4D",
    jobReference: "E704189A",
    category: "The work was started and not finished",
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
