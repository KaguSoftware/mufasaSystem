import { relations } from "drizzle-orm";
import { user } from "./auth";
import { profiles, tutorProfiles } from "./people";
import { courses, lessons, programs, quizQuestions, quizzes, units } from "./catalog";
import { classGroupMembers, classGroups, classSessions, sessionAttendees } from "./live";
import { plans, subscriptionSeats, subscriptions } from "./billing";
import { recitationAiFeedback, recitationSubmissions } from "./hifz";
import { aiConversations, aiMessages } from "./ai";

export const userRelations = relations(user, ({ one }) => ({
  profile: one(profiles, { fields: [user.id], references: [profiles.userId] }),
  tutorProfile: one(tutorProfiles, { fields: [user.id], references: [tutorProfiles.userId] }),
}));

export const profileRelations = relations(profiles, ({ one }) => ({
  user: one(user, { fields: [profiles.userId], references: [user.id] }),
}));

export const programRelations = relations(programs, ({ many }) => ({ courses: many(courses) }));

export const courseRelations = relations(courses, ({ one, many }) => ({
  program: one(programs, { fields: [courses.programId], references: [programs.id] }),
  units: many(units),
  lessons: many(lessons),
}));

export const unitRelations = relations(units, ({ one, many }) => ({
  course: one(courses, { fields: [units.courseId], references: [courses.id] }),
  lessons: many(lessons),
}));

export const lessonRelations = relations(lessons, ({ one, many }) => ({
  unit: one(units, { fields: [lessons.unitId], references: [units.id] }),
  course: one(courses, { fields: [lessons.courseId], references: [courses.id] }),
  quizzes: many(quizzes),
}));

export const quizRelations = relations(quizzes, ({ one, many }) => ({
  lesson: one(lessons, { fields: [quizzes.lessonId], references: [lessons.id] }),
  questions: many(quizQuestions),
}));

export const quizQuestionRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizQuestions.quizId], references: [quizzes.id] }),
}));

export const classGroupRelations = relations(classGroups, ({ one, many }) => ({
  tutor: one(user, { fields: [classGroups.tutorId], references: [user.id] }),
  members: many(classGroupMembers),
  sessions: many(classSessions),
}));

export const classGroupMemberRelations = relations(classGroupMembers, ({ one }) => ({
  group: one(classGroups, { fields: [classGroupMembers.groupId], references: [classGroups.id] }),
  student: one(user, { fields: [classGroupMembers.studentId], references: [user.id] }),
}));

export const classSessionRelations = relations(classSessions, ({ one, many }) => ({
  group: one(classGroups, { fields: [classSessions.groupId], references: [classGroups.id] }),
  tutor: one(user, { fields: [classSessions.tutorId], references: [user.id] }),
  attendees: many(sessionAttendees),
}));

export const sessionAttendeeRelations = relations(sessionAttendees, ({ one }) => ({
  session: one(classSessions, { fields: [sessionAttendees.sessionId], references: [classSessions.id] }),
  student: one(user, { fields: [sessionAttendees.studentId], references: [user.id] }),
}));

export const subscriptionRelations = relations(subscriptions, ({ one, many }) => ({
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  payer: one(user, { fields: [subscriptions.payerId], references: [user.id] }),
  seats: many(subscriptionSeats),
}));

export const subscriptionSeatRelations = relations(subscriptionSeats, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionSeats.subscriptionId], references: [subscriptions.id] }),
}));

export const recitationRelations = relations(recitationSubmissions, ({ one }) => ({
  student: one(user, { fields: [recitationSubmissions.studentId], references: [user.id] }),
  ai: one(recitationAiFeedback, {
    fields: [recitationSubmissions.id],
    references: [recitationAiFeedback.recitationId],
  }),
}));

export const aiConversationRelations = relations(aiConversations, ({ many }) => ({
  messages: many(aiMessages),
}));

export const aiMessageRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, { fields: [aiMessages.conversationId], references: [aiConversations.id] }),
}));
