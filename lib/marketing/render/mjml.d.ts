declare module "mjml" {
  type MjmlError = { message?: string; formattedMessage?: string };
  function mjml2html(
    input: string,
    options?: { validationLevel?: "strict" | "soft" | "skip" }
  ): { html: string; errors: MjmlError[] };
  export default mjml2html;
}
