"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "../action";
import * as dal from "../dal/certificates";

export const getCertificateDownload = action(
  { input: z.object({ id: z.string().uuid() }), flag: "certificates" },
  async ({ id }, { user }) => dal.certificateDownloadUrl(user, id),
);

export const issueManualCertificate = action(
  { input: dal.issueManualSchema, roles: ["admin"], flag: "certificates" },
  async (input, { user }) => {
    const res = await dal.issueManual(user, input);
    revalidatePath("/[locale]/admin/certificates", "page");
    return res;
  },
);

export const revokeCertificate = action({ input: dal.revokeSchema, roles: ["admin"] }, async ({ id, reason }, { user }) => {
  const res = await dal.revoke(user, id, reason);
  revalidatePath("/[locale]/admin/certificates", "page");
  return res;
});
