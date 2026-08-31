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
import type { TemplateEntry } from "./registry";

interface Props {
  name?: string;
  projectTitle?: string;
  company?: string;
  quote?: string;
  availableFrom?: string;
  message?: string;
  projectUrl?: string;
}

const Email = ({
  name,
  projectTitle,
  company,
  quote,
  availableFrom,
  message,
  projectUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {company ?? "A vetted firm"} applied to your project posting
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>TRADESMANFINDER</Text>
        <Heading style={heading}>A vetted firm wants your job</Heading>
        <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
        <Text style={text}>
          <strong>{company ?? "A vetted firm"}</strong> has applied to
          {projectTitle ? ` “${projectTitle}”` : " your project posting"}.
        </Text>
        {quote ? <Text style={refBox}>Indicative price: {quote}</Text> : null}
        {availableFrom ? (
          <Text style={text}>Available from {availableFrom}.</Text>
        ) : null}
        {message ? <Text style={quoteStyle}>{message}</Text> : null}
        {projectUrl ? (
          <Button style={button} href={projectUrl}>
            Review the application
          </Button>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          You're getting this because you asked for notifications on this
          posting. Turn them off any time from your account.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `${(data['company'] as string) ?? "A vetted firm"} applied to your project — TradesmanFinder`,
  displayName: "Project — firm applied",
  previewData: {
    name: "Jane",
    projectTitle: "Rear kitchen extension",
    company: "Webb & Sons Building",
    quote: "£18,000 – £24,000",
    availableFrom: "12 October 2026",
    message: "We've done six similar extensions in SE15 this year.",
    projectUrl: "https://tradesmanfinder.org/projects/demo",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "11px",
  letterSpacing: "2px",
  color: "#c2410c",
  margin: "0 0 6px",
};
const heading = { fontSize: "24px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
const quoteStyle = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  borderLeft: "3px solid #e5e7eb",
  paddingLeft: "12px",
};
const refBox = {
  fontSize: "14px",
  color: "#111827",
  backgroundColor: "#f3f4f6",
  padding: "10px 14px",
  borderRadius: "6px",
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
const small = { fontSize: "12px", lineHeight: "20px", color: "#6b7280" };
