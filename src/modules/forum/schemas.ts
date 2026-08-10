import { z } from "zod";

const markdown = z.string().trim().min(2).max(50_000);
const tag = z.string().trim().min(2).max(100).regex(/^[a-z0-9][a-z0-9:_-]*$/i);
export const entityIdSchema = z.string().cuid();

export const createTopicSchema = z.object({
  categorySlug: z.string().trim().min(1).max(100),
  title: z.string().trim().min(5).max(240),
  bodyMarkdown: markdown,
  tags: z.array(tag).max(8).default([]),
});

export const updateTopicSchema = z.object({
  title: z.string().trim().min(5).max(240).optional(),
  bodyMarkdown: markdown.optional(),
  tags: z.array(tag).max(8).optional(),
}).refine((value) => Object.keys(value).length > 0, "Không có thay đổi nào");

export const createReplySchema = z.object({ bodyMarkdown: markdown, parentReplyId: z.string().cuid().optional() });
export const updateReplySchema = z.object({ bodyMarkdown: markdown });

export const voteSchema = z.object({
  targetType: z.enum(["TOPIC", "REPLY"]),
  targetId: z.string().cuid(),
  value: z.enum(["UP", "DOWN"]),
});

export const reportSchema = z.object({
  targetType: z.enum(["TOPIC", "REPLY"]),
  targetId: z.string().cuid(),
  reason: z.enum(["SPAM", "OFFENSIVE", "HARASSMENT", "MISINFORMATION", "OFF_TOPIC", "COPYRIGHT", "OTHER"]),
  note: z.string().trim().max(2_000).optional(),
  detail: z.string().trim().max(2_000).optional(),
});

export const listTopicsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["latest", "top", "unanswered"]).default("latest"),
  category: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(100).optional(),
});

export const topicIdSchema = z.object({ topicId: z.string().cuid() });
export const moderationReportQuerySchema = z.object({ status: z.enum(["pending", "reviewed", "dismissed", "action_taken"]).default("pending") });
export const resolveReportSchema = z.object({ status: z.enum(["REVIEWED", "DISMISSED", "ACTION_TAKEN"]), actionTaken: z.string().trim().max(2_000).optional() });
export const searchSchema = z.object({ q: z.string().trim().min(2).max(200), category: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20) });
