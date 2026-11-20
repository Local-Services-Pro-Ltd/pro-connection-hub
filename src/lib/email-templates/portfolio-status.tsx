import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { BrandFooter, BrandHeader } from "./brand";
import type { TemplateEntry } from "./registry";

interface Props {
  title?: string;
  decision?: "approved" | "rejected";
  reviewerNote?: string | null;
  profileUrl?: string;
}

const Email = ({ title = "Your job", decision = "approved", reviewerNote, profileUrl }: Props) => {
  const approved = decision === "approved";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {approved ? `Your job '${title}' is now on your profile` : `We couldn't publish '${title}'`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <BrandHeader />
          <Heading style={heading}>
            {approved
              ? `Your job '${title}' is now on your profile`
              : `We couldn't publish '${title}'`}
          </Heading>
          {approved && profileUrl ? (
            <Button style={button} href={profileUrl}>
              View your profile
            </Button>
          ) : null}
          {!approved && reviewerNote ? <Text style={note}>{reviewerNote}</Text> : null}
          {!approved ? (
            <Text style={text}>Edit it in your dashboard and it will come back to us.</Text>
          ) : null}
          <BrandFooter />
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data["decision"] === "rejected"
      ? `We couldn't publish '${(data["title"] as string) ?? "Your job"}'`
      : `Your job '${(data["title"] as string) ?? "Your job"}' is now on your profile`,
  displayName: "Work gallery — review decision",
  previewData: {
    title: "Kitchen renovation",
    decision: "approved",
    profileUrl: "https://tradesmanfinder.org/pro/example-firm",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { padding: "28px 26px", maxWidth: "560px" };
const heading = { fontSize: "24px", lineHeight: "32px", color: "#111827", margin: "0 0 18px" };
const text = { fontSize: "15px", lineHeight: "24px", color: "#374151" };
const note = { ...text, borderLeft: "3px solid #e5e7eb", paddingLeft: "12px" };
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
