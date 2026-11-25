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
  accepted?: boolean;
  contactName?: string;
  contactEmail?: string;
  dashboardUrl?: string;
}

const Email = ({
  company,
  reference,
  title,
  accepted,
  contactName,
  contactEmail,
  dashboardUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {accepted
        ? `Your quote for job ${reference ?? ""} was accepted`
        : `Job ${reference ?? ""} has gone to another firm`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>
          {accepted ? "Your quote was accepted" : "This job has gone to another firm"}
        </Heading>
        <Text style={item}>Reference: {reference}</Text>
        <Text style={item}>Job: {title}</Text>
        {accepted ? (
          <>
            <Text style={text}>
              The homeowner has chosen {company}. Please contact them to confirm the start date and
              put the agreement in writing before work begins.
            </Text>
            <Text style={item}>Homeowner: {contactName}</Text>
            <Text style={item}>Email: {contactEmail}</Text>
          </>
        ) : (
          <Text style={text}>
            The homeowner did not choose {company}'s quote this time. Thank you for quoting. Your
            quote stays in your dashboard for your records.
          </Text>
        )}
        {dashboardUrl ? (
          <Button style={button} href={dashboardUrl}>
            Open your dashboard
          </Button>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          {accepted
            ? "The agreement for this work is between you and the homeowner. TradesmanFinder is not a party to it."
            : "Please don't contact the homeowner about this job again."}
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data["accepted"]
      ? `Your quote for job ${(data["reference"] as string) ?? ""} was accepted`
      : `Job ${(data["reference"] as string) ?? ""} has gone to another firm`,
  displayName: "Quote — decision for the firm",
  previewData: {
    company: "Smith Plumbing",
    reference: "E704189A",
    title: "Replace a leaking kitchen tap",
    accepted: true,
    contactName: "Alex Jones",
    contactEmail: "alex@example.com",
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
