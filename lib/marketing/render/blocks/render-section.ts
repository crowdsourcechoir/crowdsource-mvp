import type { EmailSection } from "../../document/types";
import { renderArtistFeature } from "./artist-feature";
import { renderCta } from "./cta";
import { renderDivider } from "./divider";
import { renderEditorialText } from "./editorial-text";
import { renderEvent } from "./event";
import { renderFooter } from "./footer";
import { renderFullBleedImage } from "./full-bleed-image";
import { renderGallery } from "./gallery";
import { renderHero } from "./hero";
import { renderImageStory } from "./image-story";
import { renderLargeStatement } from "./large-statement";
import { renderPullQuote } from "./pull-quote";
import { renderSongGardenInvitation } from "./song-garden-invitation";
import { renderSpacer } from "./spacer";
import { renderTwoColumn } from "./two-column";
import type { RenderedSection, SectionContext } from "../section";

const RENDERERS: Partial<Record<EmailSection["type"], (section: EmailSection, ctx: SectionContext) => RenderedSection | { error: string }>> = {
  hero: renderHero,
  full_bleed_image: renderFullBleedImage,
  editorial_text: renderEditorialText,
  large_statement: renderLargeStatement,
  image_story: renderImageStory,
  two_column: renderTwoColumn,
  pull_quote: renderPullQuote,
  event: renderEvent,
  song_garden_invitation: renderSongGardenInvitation,
  artist_feature: renderArtistFeature,
  cta: renderCta,
  gallery: renderGallery,
  divider: renderDivider,
  spacer: renderSpacer,
  footer: renderFooter,
};

export function renderSection(section: EmailSection, ctx: SectionContext): RenderedSection | { error: string } {
  const render = RENDERERS[section.type];
  if (!render) return { error: `no renderer for section type ${section.type}` };
  return render(section, ctx);
}
