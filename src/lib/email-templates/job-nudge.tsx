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
  reference?: string;
  jobUrl?: string;
  /** "finished" asks whether the work is done; "review" asks for the review. */
  stage?: "finished" | "review";
}

const Email = ({ contactName, company, reference, jobUrl, stage }: Props) => {
  const review = stage === "review";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {review
          ? `How did ${company ?? "the firm"} do? Leave a review`
          : `Has ${company ?? "the firm"} finished your job?`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <BrandHeader />
          <Heading style={heading}>
            {review ? `How did ${company} do?` : `Has ${company} finished your job?`}
          </Heading>
          <Text style={text}>
            {contactName ? `Hello ${contactName},` : "Hello,"}{" "}
            {review
              ? `you told us ${company} has finished job ${reference}. A short review helps the next homeowner choose, and it is the only way reviews are collected here.`
              : `you chose ${company} for job ${reference}. When the work is done, please tell us. That lets you leave a review.`}
          </Text>
          {jobUrl ? (
            <Button style={button} href={jobUrl}>
              {review ? "Leave your review" : "Tell us the work is finished"}
            </Button>
          ) : null}
          <Text style={text}>
            {review
              ? "It takes about two minutes: five quick ratings and a few words. We show your first name only."
              : "If it hasn't started or something has gone wrong, the same page lets you report a problem."}
          </Text>
          <Hr style={rule} />
          <Text style={small}>
            We send this once. This link is private to you, so please don't forward it.
          </Text>
          <BrandFooter />
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, unknown>) =>
    data["stage"] === "review"
      ? `How did ${(data["company"] as string) || "the firm"} do?`
      : `Has ${(data["company"] as string) || "the firm"} finished your job?`,
  displayName: "Job — finished or review nudge",
  previewData: {
    contactName: "Alex",
    company: "Smith Plumbing",
    reference: "E704189A",
    jobUrl: "https://tradesmanfinder.org/job-status?t=example",
    stage: "review",
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
