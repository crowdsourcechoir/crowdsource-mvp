import type { EmailSection } from "../../document/types";
import { renderCta } from "./cta";
import { renderDivider } from "./divider";
import { renderEditorialText } from "./editorial-text";
import { renderEvent } from "./event";
import { renderFooter } from "./footer";
import { renderFullBleedImage } from "./full-bleed-image";
import { renderHero } from "./hero";
import { renderImageStory } from "./image-story";
import { renderSpacer } from "./spacer";
import type { RenderedSection, SectionContext } from "../section";

const RENDERERS: Partial<Record<EmailSection["type"], (section: EmailSection, ctx: SectionContext) => RenderedSection | { error: string }>> = {
  hero: renderHero,
  full_bleed_image: renderFullBleedImage,
  editorial_text: renderEditorialText,
  image_story: renderImageStory,
  cta: renderCta,
  divider: renderDivider,
  spacer: renderSpacer,
  footer: renderFooter,
  event: renderEvent,
};

export function renderSection(section: EmailSection, ctx: SectionContext): RenderedSection | { error: string } {
  const render = RENDERERS[section.type];
  if (!render) return { error: `no renderer for section type ${section.type}` };
  return render(section, ctx);
}
