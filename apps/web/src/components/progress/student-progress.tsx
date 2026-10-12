import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { t18n } from "@mufasa/config/locales";
import { HifzOverviewView } from "@/components/hifz/hifz-overview";
import { HomeworkList } from "@/components/homework/homework-list";
import { RecitationCard } from "@/components/recitation/recitation-card";
import { RecitationForm } from "@/components/recitation/recitation-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from "@/components/ui/controls";
import { EmptyState, Progress } from "@/components/ui/misc";
import { AttendanceSummary } from "@/components/live/attendance-summary";
import { hifzOverview } from "@/server/dal/hifz";
import { studentHomework } from "@/server/dal/homework";
import { myCourses } from "@/server/dal/learn";
import { expectedText, listRecitations, recitationFormData } from "@/server/dal/recitations";
import { listSurahs } from "@/server/dal/tutoring";
import type { SessionUser } from "@/server/session";

/**
 * Tabbed progress view of one student for staff and parents:
 * Courses, Hifz, Recitations, Homework, Attendance (slot for the live-classes module).
 * `manage`: "staff" lets a tutor/admin edit hifz; "parent" lets a parent add plans and record.
 */
export async function StudentProgress({
  actor,
  studentId,
  manage,
  defaultTab = "courses",
}: {
  actor: SessionUser;
  studentId: string;
  manage: "staff" | "parent";
  defaultTab?: "courses" | "hifz" | "recitations" | "homework" | "attendance";
}) {
  const [t, th, locale, format] = await Promise.all([
    getTranslations("hifz"),
    getTranslations("learn"),
    getLocale(),
    getFormatter(),
  ]);
  const [courses, overview, surahs, recitations, homework] = await Promise.all([
    myCourses(actor, studentId),
    hifzOverview(actor, studentId),
    listSurahs(),
    listRecitations(actor, studentId, 20),
    studentHomework(actor, studentId),
  ]);
  const expected = await Promise.all(recitations.map((r) => (r.ai?.status === "done" ? expectedText(r.surah, r.ayahFrom, r.ayahTo) : null)));
  const form = manage === "parent" ? await recitationFormData(actor, studentId) : null;

  return (
    <TabsRoot defaultValue={defaultTab}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="courses">{t("tabCourses")}</TabsTrigger>
        <TabsTrigger value="hifz">{t("tabHifz")}</TabsTrigger>
        <TabsTrigger value="recitations">{t("tabRecitations")}</TabsTrigger>
        <TabsTrigger value="homework">{t("tabHomework")}</TabsTrigger>
        <TabsTrigger value="attendance">{t("tabAttendance")}</TabsTrigger>
      </TabsList>

      <TabsContent value="courses">
        {courses.length === 0 ? (
          <EmptyState title={t("noCourses")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <Card key={c.courseId}>
                <CardBody className="grid gap-3">
                  <div>
                    <p className="text-xs text-muted">{t18n(c.programName, locale)}</p>
                    <p className="font-semibold">{t18n(c.title, locale)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={c.percent} />
                    <span className="text-sm tabular-nums text-muted">{c.percent}%</span>
                  </div>
                  <p className="text-xs text-muted">{th("lessonsProgress", { done: c.completedLessons, total: c.totalLessons })}</p>
                  {c.completedAt && <Badge tone="success" className="self-start">{th("completed")}</Badge>}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="hifz">
        <HifzOverviewView overview={overview} surahs={surahs} manage={manage} />
      </TabsContent>

      <TabsContent value="recitations">
        <div className="flex flex-col gap-4">
          {form?.recordingAllowed && (
            <Card>
              <CardBody>
                <p className="mb-4 font-semibold">{t("recordForChild")}</p>
                <RecitationForm
                  studentId={studentId}
                  surahs={form.surahs}
                  entries={form.entries}
                  homework={form.homework}
                  aiAvailable={form.aiAvailable}
                />
              </CardBody>
            </Card>
          )}
          {recitations.length === 0 ? (
            <EmptyState title={t("noRecitations")} />
          ) : (
            recitations.map((r, i) => (
              <RecitationCard
                key={r.id}
                item={r}
                expected={expected[i]}
                dateLabel={format.dateTime(r.createdAt, { dateStyle: "medium" })}
              />
            ))
          )}
        </div>
      </TabsContent>

      <TabsContent value="homework">
        <HomeworkList items={homework} studentId={studentId} interactive={false} />
      </TabsContent>

      <TabsContent value="attendance">
        <AttendanceSummary user={actor} studentId={studentId} />
      </TabsContent>
    </TabsRoot>
  );
}
