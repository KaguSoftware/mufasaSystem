"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/components/catalog/use-run-action";
import { useRouter } from "@/i18n/navigation";
import { enrollAction } from "@/server/actions/learn";

export function EnrollButton({
  courseId,
  studentId,
  slug,
  variant = "primary",
}: {
  courseId: string;
  studentId: string;
  slug: string;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("learn");
  const run = useRunAction();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    const res = await run(() => enrollAction({ studentId, courseId }), { success: t("enrolledToast"), refresh: false });
    setLoading(false);
    if (res.ok) router.push(`/student/courses/${slug}`);
  }

  return (
    <Button variant={variant} size="sm" loading={loading} onClick={go}>
      {t("enroll")}
    </Button>
  );
}
