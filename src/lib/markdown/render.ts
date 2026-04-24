"use client";

import DOMPurify from "dompurify";

const ALLOW_TAGS = [
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "del",
  "s",
  "code",
  "pre",
  "blockquote",
  "p",
  "br",
  "span",
  "ul",
  "ol",
  "li",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "mx-reply",
];
const ALLOW_ATTR = ["href", "title", "class", "data-mx-color", "data-mx-bg-color"];

export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ALLOW_TAGS,
    ALLOWED_ATTR: ALLOW_ATTR,
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ["style", "script", "iframe", "form", "input", "link", "meta"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}
