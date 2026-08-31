import * as React from "react";
import {
  Body,
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
  company?: string;
  reference?: string;
  message?: string;
  responseMins?: number;
}

const Email = ({ name, company, reference, message, responseMins }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your enquiry has been sent{company ? ` to ${company}` : ""}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>TRADESMANFINDER</Text>
        <Heading style={heading}>Your enquiry is on its way</Heading>
        <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
        <Text style={text}>
          We've passed your job details to{" "}
          <strong>{company ?? "the firm you contacted"}</strong>. They typically
          reply within {responseMins ?? 60} minutes during working hours.
        </Text>
        {reference ? (
          <Text style={refBox}>Your reference: {reference}</Text>
        ) : null}
        {message ? (
          <>
            <Text style={label}>What you sent</Text>
            <Text style={quote}>{message}</Text>
          </>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          Every firm on TradesmanFinder is identity-, insurance- and
          trade-checked before it can receive enquiries. If anything feels off,
          reply to this email and we'll step in.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `Your enquiry to ${(data['company'] as string) ?? "a vetted firm"} — TradesmanFinder`,
  displayName: "Lead — homeowner confirmation",
  previewData: {
    name: "Jane",
    company: "Webb & Sons Building",
    reference: "TFL-4B2C9A11",
    message: "Rear extension, roughly 20 sqm, hoping to start in the spring.",
    responseMins: 45,
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
const label = {
  fontSize: "12px",
  letterSpacing: "1px",
  color: "#6b7280",
  margin: "20px 0 4px",
};
const quote = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#374151",
  borderLeft: "3px solid #e5e7eb",
  paddingLeft: "12px",
  margin: "0",
};
const refBox = {
  fontSize: "14px",
  color: "#111827",
  backgroundColor: "#f3f4f6",
  padding: "10px 14px",
  borderRadius: "6px",
};
const rule = { borderColor: "#e5e7eb", margin: "24px 0" };
const small = { fontSize: "12px", lineHeight: "20px", color: "#6b7280" };
