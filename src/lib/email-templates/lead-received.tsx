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
  company?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  postcode?: string;
  trade?: string;
  budget?: string;
  timing?: string;
  message?: string;
  reference?: string;
}

const Email = ({
  company,
  customerName,
  customerEmail,
  customerPhone,
  postcode,
  trade,
  budget,
  timing,
  message,
  reference,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      New enquiry{postcode ? ` in ${postcode}` : ""} from TradesmanFinder
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>TRADESMANFINDER</Text>
        <Heading style={heading}>New enquiry for you</Heading>
        <Text style={text}>{company ? `Hi ${company},` : "Hi there,"}</Text>
        <Text style={text}>
          A homeowner found you in the directory and sent a job through. Reply
          quickly — response time is part of your trust score.
        </Text>
        <Text style={label}>Contact</Text>
        <Text style={text}>
          {customerName ?? "Homeowner"}
          <br />
          {customerEmail}
          {customerPhone ? (
            <>
              <br />
              {customerPhone}
            </>
          ) : null}
        </Text>
        <Text style={label}>Job</Text>
        <Text style={text}>
          {trade ? `${trade} · ` : ""}
          {postcode}
          {timing ? ` · ${timing}` : ""}
          {budget ? ` · ${budget}` : ""}
        </Text>
        {message ? <Text style={quote}>{message}</Text> : null}
        {reference ? <Text style={refBox}>Reference: {reference}</Text> : null}
        <Hr style={rule} />
        <Text style={small}>
          Sent because this enquiry was addressed to your listing on
          TradesmanFinder.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `New enquiry${data['postcode'] ? ` in ${data['postcode']}` : ""} — TradesmanFinder`,
  displayName: "Lead — firm notification",
  previewData: {
    company: "Webb & Sons Building",
    customerName: "Jane Okafor",
    customerEmail: "jane@example.com",
    customerPhone: "07700 900123",
    postcode: "SE15 4TR",
    trade: "Builder",
    budget: "£2,000 – £10,000",
    timing: "Within a month",
    message: "Rear extension, roughly 20 sqm.",
    reference: "TFL-4B2C9A11",
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
