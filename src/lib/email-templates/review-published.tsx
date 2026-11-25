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
  rating?: number;
  dashboardUrl?: string;
}

const Email = ({ company, rating, dashboardUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A homeowner's review of {company ?? "your firm"} has been published</Preview>
    <Body style={main}>
      <Container style={container}>
        <BrandHeader />
        <Heading style={heading}>You have a new review</Heading>
        <Text style={text}>
          A homeowner whose job {company} completed has left a review, and it is now on your
          profile.
        </Text>
        <Text style={item}>Overall rating: {rating} out of 5</Text>
        {dashboardUrl ? (
          <Button style={button} href={dashboardUrl}>
            Read it and reply
          </Button>
        ) : null}
        <Text style={text}>
          You can post one public reply from the Reviews tab in your dashboard. We check replies
          before they appear.
        </Text>
        <Hr style={rule} />
        <Text style={small}>
          If you believe the review breaks our review rules, you can report it from the same tab. A
          low score is not, by itself, a reason for us to remove a review.
        </Text>
        <BrandFooter />
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    `A review of ${(data["company"] as string) || "your firm"} has been published`,
  displayName: "Review — published (firm)",
  previewData: {
    company: "Smith Plumbing",
    rating: 5,
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
