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
import type { TemplateEntry } from "./registry";

interface Props {
  company?: string;
  contactName?: string;
  status?: string;
  reviewerNote?: string;
  actionUrl?: string;
}

const headlines: Record<string, string> = {
  approved: "Your listing claim has been approved.",
  rejected: "We couldn't approve your listing claim.",
  in_review: "Your listing claim is being reviewed.",
};

const Email = ({ company, contactName, status, reviewerNote, actionUrl }: Props) => {
  const headline = headlines[status ?? ""] ?? "Update on your listing claim.";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER</Text>
          <Heading style={heading}>{headline}</Heading>
          <Text style={text}>{contactName ? `Hi ${contactName},` : "Hi there,"}</Text>
          <Text style={text}>Listing: {company ?? "—"}</Text>
          {status === "approved" ? (
            <Text style={text}>
              Your account can now manage this listing. It remains marked vetting in progress until
              the required ID and insurance checks pass.
            </Text>
          ) : status === "rejected" ? (
            <Text style={text}>
              {reviewerNote ||
                "We couldn't confirm that you're authorised to manage this listing. You can contact us if you think we've missed something."}
            </Text>
          ) : (
            <Text style={text}>
              A member of our compliance and onboarding team is reviewing your claim. Your account
              is not linked to the listing until the claim is approved.
            </Text>
          )}
          {actionUrl ? (
            <Button style={button} href={actionUrl}>
              Search listings
            </Button>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
};

const main = { backgroundColor: "#ffffff", fontFamily: "Helvetica, Arial, sans-serif" };
const container = { margin: "0 auto", padding: "32px 28px", maxWidth: "560px" };
const eyebrow = { color: "#c95728", fontSize: "11px", letterSpacing: "2px", margin: "0 0 12px" };
const heading = { color: "#17191c", fontSize: "24px", margin: "0 0 16px" };
const text = { color: "#45484d", fontSize: "15px", lineHeight: "24px" };
const button = {
  backgroundColor: "#e2703a",
  borderRadius: "6px",
  color: "#12100e",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data["status"] === "approved"
      ? "Your TradesmanFinder listing claim is approved"
      : "Update on your TradesmanFinder listing claim",
  displayName: "Listing claim status",
  previewData: { company: "Example Roofing Ltd", contactName: "Sam", status: "rejected" },
} satisfies TemplateEntry;
