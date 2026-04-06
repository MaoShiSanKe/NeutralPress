"use client";

import { useEffect, useState } from "react";

import { formatRelativeTime } from "@/lib/shared/relative-time";
import { Tooltip } from "@/ui/Tooltip";

type DateValue = Date | string | null | undefined;
type BrowserDateTimePrecision = "date" | "minute" | "second";
type BrowserDateTimeStyle = "default" | "dots";

const FORMAT_OPTIONS: Record<
  BrowserDateTimePrecision,
  Intl.DateTimeFormatOptions
> = {
  date: {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
  minute: {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  },
  second: {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  },
};

function normalizeDate(value: DateValue): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(
  date: Date,
  precision: BrowserDateTimePrecision,
  locale: string,
  displayStyle: BrowserDateTimeStyle,
): string {
  const formatted = new Intl.DateTimeFormat(
    locale,
    FORMAT_OPTIONS[precision],
  ).format(date);

  if (displayStyle === "dots") {
    return formatted.replace(/\//g, ".");
  }

  return formatted;
}

interface BrowserDateTimeProps {
  value: DateValue;
  fallback?: string;
  precision?: BrowserDateTimePrecision;
  locale?: string;
  displayStyle?: BrowserDateTimeStyle;
  className?: string;
}

export default function BrowserDateTime({
  value,
  fallback = "-",
  precision = "minute",
  locale = "zh-CN",
  displayStyle = "default",
  className,
}: BrowserDateTimeProps) {
  const date = normalizeDate(value);
  const [formattedText, setFormattedText] = useState<string | null>(null);
  const [relativeText, setRelativeText] = useState("");

  useEffect(() => {
    if (!date) {
      setFormattedText(null);
      setRelativeText("");
      return;
    }

    setFormattedText(formatDateTime(date, precision, locale, displayStyle));
    setRelativeText(formatRelativeTime(date));
  }, [date, displayStyle, locale, precision]);

  if (!date) {
    return <span className={className}>{fallback}</span>;
  }

  const timeElement = (
    <time
      className={className}
      dateTime={date.toISOString()}
      suppressHydrationWarning
    >
      {formattedText ?? fallback}
    </time>
  );

  return (
    <Tooltip content={relativeText} delay={250} inline disabled={!relativeText}>
      {timeElement}
    </Tooltip>
  );
}
