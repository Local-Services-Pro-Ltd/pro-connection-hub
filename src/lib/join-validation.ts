export type JoinFormValues = {
  businessType: string;
  company: string;
  tradeSlug: string;
  postcode: string;
  about: string;
  website: string;
  contactName: string;
  email: string;
  phone: string;
};

export type JoinField = keyof JoinFormValues | "consent";

export function validateJoinForm(form: JoinFormValues, consent: boolean) {
  const errors: Partial<Record<JoinField, string>> = {};
  if (!form.businessType) errors.businessType = "Choose how your business is set up.";
  if (form.company.trim().length < 2) errors.company = "Enter your business or trading name.";
  if (!form.tradeSlug) errors.tradeSlug = "Choose your main trade.";
  if (form.postcode.trim().length < 2) errors.postcode = "Enter the postcode you work from.";
  if (form.about.trim().length < 10) errors.about = "Tell us a little more about the work you do.";
  if (form.contactName.trim().length < 2) errors.contactName = "Enter your full name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
    errors.email = "Enter a valid email address.";
  if (!consent) errors.consent = "Confirm the declaration before sending your application.";
  return errors;
}
