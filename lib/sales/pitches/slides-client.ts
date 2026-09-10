import { google, drive_v3, slides_v1 } from "googleapis";
import { getGmailConnection } from "../db/gmail";
import { decryptSecret } from "../gmail/crypto";
import { createOAuth2Client, gmailConfigured } from "../gmail/oauth";
import { GMAIL_OWNER_KEY } from "../gmail/constants";
import { hasSlidesScopes } from "./constants";

export type SlidesClientBundle = {
  slides: slides_v1.Slides;
  drive: drive_v3.Drive;
  auth: ReturnType<typeof createOAuth2Client>;
  email: string;
  scopes: string[];
  connectionId: string;
  slidesGranted: boolean;
};

/** Authenticated Slides + Drive client using the same Google connection as Gmail. */
export async function getSlidesClient(
  ownerKey: string = GMAIL_OWNER_KEY
): Promise<SlidesClientBundle | null> {
  if (!gmailConfigured()) return null;
  const connection = await getGmailConnection(ownerKey);
  if (!connection) return null;

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: decryptSecret(connection.refreshTokenEncrypted) });
  return {
    slides: google.slides({ version: "v1", auth: client }),
    drive: google.drive({ version: "v3", auth: client }),
    auth: client,
    email: connection.email,
    scopes: connection.scopes,
    connectionId: connection.id,
    slidesGranted: hasSlidesScopes(connection.scopes),
  };
}

export function slidesUrlForPresentation(presentationId: string): string {
  return `https://docs.google.com/presentation/d/${presentationId}/edit`;
}

export async function copySlidesTemplate(input: {
  templateFileId: string;
  title: string;
}): Promise<{ presentationId: string; url: string }> {
  const bundle = await getSlidesClient();
  if (!bundle) throw new Error("Google is not connected.");
  if (!bundle.slidesGranted) {
    throw new Error("Slides access not granted. Reconnect Google and allow Slides + Drive.");
  }

  const copied = await bundle.drive.files.copy({
    fileId: input.templateFileId,
    requestBody: { name: input.title },
    fields: "id",
    supportsAllDrives: true,
  });
  const presentationId = copied.data.id;
  if (!presentationId) throw new Error("Google Drive did not return a new presentation id.");
  return { presentationId, url: slidesUrlForPresentation(presentationId) };
}

export async function replacePlaceholdersInPresentation(
  presentationId: string,
  replacements: Record<string, string>
): Promise<void> {
  const bundle = await getSlidesClient();
  if (!bundle) throw new Error("Google is not connected.");
  if (!bundle.slidesGranted) {
    throw new Error("Slides access not granted. Reconnect Google and allow Slides + Drive.");
  }

  const requests: slides_v1.Schema$Request[] = Object.entries(replacements)
    .filter(([, value]) => typeof value === "string")
    .map(([token, value]) => ({
      replaceAllText: {
        containsText: { text: token, matchCase: true },
        replaceText: value || " ",
      },
    }));

  if (requests.length === 0) return;

  await bundle.slides.presentations.batchUpdate({
    presentationId,
    requestBody: { requests },
  });
}

/** Export presentation as PDF bytes via Drive. */
export async function exportPresentationPdf(presentationId: string): Promise<Buffer> {
  const bundle = await getSlidesClient();
  if (!bundle) throw new Error("Google is not connected.");
  if (!bundle.slidesGranted) {
    throw new Error("Slides access not granted. Reconnect Google and allow Slides + Drive.");
  }

  const res = await bundle.drive.files.export(
    {
      fileId: presentationId,
      mimeType: "application/pdf",
    },
    { responseType: "arraybuffer" }
  );
  const data = res.data as ArrayBuffer | Buffer | string;
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data);
  return Buffer.from(data);
}
