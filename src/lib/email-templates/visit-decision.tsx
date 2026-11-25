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
  when?: string;
  accepted?: boolean;
  note?: string;
  reference?: string;
  profileUrl?: string;
}

const Email = ({ contactName, company, when, accepted, note, reference, profileUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {accepted
        ? `${company ?? "The firm"} has confirmed your visit`
        : `${company ?? "The firm"} can't make that time`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>
          {accepted ? "Your visit is confirmed" : "The firm can't make that time"}
        </Heading>
        <Text style={text}>
          {contactName ? `Hello ${contactName},` : "Hello,"}{" "}
          {accepted
            ? `${company} has confirmed your visit.`
            : `${company} isn't able to visit at the time you asked for.`}
        </Text>
        <Text style={item}>
          When: <strong>{when}</strong>
        </Text>
        <Text style={item}>Reference: {reference}</Text>
        {note ? (
          <>
            <Text style={text}>Message from {company}:</Text>
            <Text style={quote}>{note}</Text>
          </>
        ) : null}
        {profileUrl ? (
          <Button style={button} href={profileUrl}>
            {accepted ? "View the firm's profile" : "Choose another time"}
          </Button>
        ) : null}
        <Hr style={rule} />
        <Text style={small}>
          {accepted
            ? "If you need to change or cancel, reply to hello@tradesmanfinder.org with your reference and we will tell the firm."
            : "You can pick a listed slot or suggest another time from the firm's profile."}
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
      ? `Your visit with ${(data["company"] as string) || "the firm"} is confirmed`
      : `${(data["company"] as string) || "The firm"} can't make the time you asked for`,
  displayName: "Visit — decision for the homeowner",
  previewData: {
    contactName: "Alex",
    company: "Smith Plumbing",
    when: "Thursday 26 November at 17:30",
    accepted: true,
    note: "See you then. I'll call when I'm ten minutes away.",
    reference: "AB12CD34",
    profileUrl: "https://tradesmanfinder.org/pro/smith-plumbing",
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
