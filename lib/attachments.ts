export type Attachment = {
  url: string;
  name: string;
  size: number;
  type: string;
};
export type UploadedAttachment = Attachment & { token: string };
export const attachmentCategories = ["contracts", "invoice-applications", "invoices", "payments"] as const;
export type AttachmentCategory = typeof attachmentCategories[number];
