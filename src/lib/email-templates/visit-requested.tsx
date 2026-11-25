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
  when?: string;
  suggested?: boolean;
  contactName?: string;
  postcode?: string | null;
  notes?: string;
  reference?: string;
  dashboardUrl?: string;
}

const Email = ({
  company,
  when,
  suggested,
  contactName,
  postcode,
  notes,
  reference,
  dashboardUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {suggested ? "A homeowner has suggested a visit time" : "New visit request"}: {when ?? ""}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>
          {suggested ? "A homeowner has suggested a visit time" : "You have a visit request"}
        </Heading>
        <Text style={text}>
          {suggested
            ? `A homeowner would like ${company} to visit at a time outside your listed slots. It is not booked unless you accept it.`
            : `A homeowner has asked ${company} for one of your listed visit slots. Please accept or decline it.`}
        </Text>
        <Text style={item}>
          When: <strong>{when}</strong>
        </Text>
        <Text style={item}>Homeowner: {contactName}</Text>
        {postcode ? <Text style={item}>Postcode: {postcode}</Text> : null}
        <Text style={item}>Reference: {reference}</Text>
        {notes ? <Text style={quote}>{notes}</Text> : null}
        {dashboardUrl ? (
          <Button style={button} href={dashboardUrl}>
            Accept or decline
          </Button>
        ) : null}
        <Text style={text}>
          Open the Visits tab in your dashboard. If you can't make this time, decline and add a
          short note suggesting when you can.
        </Text>
        <Hr style={rule} />
        <Text style={small}>The homeowner is emailed as soon as you answer.</Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `${data["suggested"] ? "Suggested visit time" : "Visit request"}: ${(data["when"] as string) ?? ""}`,
  displayName: "Visit — request for the firm",
  previewData: {
    company: "Smith Plumbing",
    when: "Thursday 26 November at 17:30",
    suggested: true,
    contactName: "Alex Jones",
    postcode: "ME14 1AA",
    notes: "Leaking tap in the kitchen. Evenings suit me best.",
    reference: "AB12CD34",
    dashboardUrl: "https://tradesmanfinder.org/dashboard",
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
