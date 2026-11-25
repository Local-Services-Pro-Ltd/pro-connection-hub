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
  title?: string;
  contactName?: string;
  postcode?: string;
  dashboardUrl?: string;
}

const Email = ({ company, reference, title, contactName, postcode, dashboardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You have been invited to quote for job {reference ?? ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>You have been invited to quote</Heading>
        <Text style={text}>
          A homeowner has chosen {company} as one of up to three firms to quote for their job.
        </Text>
        <Text style={item}>Reference: {reference}</Text>
        <Text style={item}>Job: {title}</Text>
        <Text style={item}>Homeowner: {contactName}</Text>
        <Text style={item}>Postcode: {postcode}</Text>
        {dashboardUrl ? (
          <Button style={button} href={dashboardUrl}>
            Write your quote
          </Button>
        ) : null}
        <Text style={text}>
          Open the Quotes tab in your dashboard to see the full job and the homeowner's email
          address. Your quote uses the same headings as the other firms', so the homeowner can
          compare them fairly.
        </Text>
        <Hr style={rule} />
        <Text style={small}>
          The homeowner's details are shared with you only to quote for and carry out this job.
          Please don't use them for anything else.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `You have been invited to quote for job ${(data["reference"] as string) ?? ""}`.trim(),
  displayName: "Quote — firm invited",
  previewData: {
    company: "Smith Plumbing",
    reference: "E704189A",
    title: "Replace a leaking kitchen tap",
    contactName: "Alex Jones",
    postcode: "ME14 1AA",
    dashboardUrl: "https://tradesmanfinder.org/dashboard",
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
