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
  status?: "published" | "rejected";
  reviewerNote?: string;
  projectUrl?: string;
  reference?: string;
}

const Email = ({
  name,
  projectTitle,
  status,
  reviewerNote,
  projectUrl,
  reference,
}: Props) => {
  const live = status !== "rejected";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {live
          ? "Your project posting is live"
          : "We couldn't publish your project posting"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>TRADESMANFINDER</Text>
          <Heading style={heading}>
            {live
              ? "Your posting is live"
              : "We couldn't publish your posting"}
          </Heading>
          <Text style={text}>{name ? `Hi ${name},` : "Hi there,"}</Text>
          <Text style={text}>
            {live
              ? `“${projectTitle ?? "Your project"}” has passed review and vetted firms in your area can now apply.`
              : `“${projectTitle ?? "Your project"}” didn't pass review, so it hasn't gone on the board.`}
          </Text>
          {reviewerNote ? (
            <>
              <Text style={label}>Note from the review team</Text>
              <Text style={quote}>{reviewerNote}</Text>
            </>
          ) : null}
          {reference ? <Text style={refBox}>Reference: {reference}</Text> : null}
          {projectUrl ? (
            <Button style={button} href={projectUrl}>
              {live ? "View your posting" : "Edit and resubmit"}
            </Button>
          ) : null}
          <Hr style={rule} />
          <Text style={small}>
            Only identity-, insurance- and trade-checked firms can see and apply
            to postings on TradesmanFinder.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data['status'] === "rejected"
      ? "About your TradesmanFinder project posting"
      : "Your project posting is live — TradesmanFinder",
  displayName: "Project — review decision",
  previewData: {
    name: "Jane",
    projectTitle: "Rear kitchen extension",
    status: "published",
    projectUrl: "https://tradesmanfinder.org/projects/demo",
    reference: "TFP-9A21C40B",
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
