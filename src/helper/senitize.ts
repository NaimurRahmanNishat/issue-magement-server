import sanitize from "mongo-sanitize";

export const sanitizeBody = <T extends object>(obj: T): T => {
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const safeKey = sanitize(key) as string;
    (cleaned as any)[safeKey] = sanitize((obj as any)[key]);
  }
  return cleaned as T;
};
