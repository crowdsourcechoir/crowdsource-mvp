import Link from "next/link";
import { choirMedia } from "@/lib/choir-site/media";

const LOGOS = [
  { src: choirMedia.starbucks, alt: "Starbucks" },
  { src: choirMedia.rei, alt: "REI" },
  { src: choirMedia.microsoft, alt: "Microsoft" },
  { src: choirMedia.amazon, alt: "Amazon" },
  { src: choirMedia.seattleu, alt: "Seattle University" },
];

const MODES = [
  {
    title: "Raise the vibe",
    image: choirMedia.modeRaise,
    body: "High-energy, inclusive participation that aligns a crowd quickly. Conferences, offsites, fundraisers, community gatherings.",
  },
  {
    title: "Un-Keynote",
    image: choirMedia.modeKeynote,
    body: "The opposite of a talk. Activating the collective potential of the room is the message. Openers, closers, leadership moments, cultural events.",
  },
  {
    title: "Creative Amplifier",
    image: choirMedia.modeCreative,
    body: "Unlocks imagination and shared flow through co-creation. Everyone participates. Brand activations, innovation labs, retreats, offsites.",
  },
  {
    title: "Thresholds",
    image: choirMedia.modeThreshold,
    body: "Marks transition and meaning with care and intention. Milestones, ceremonies, birthdays, memorials, chapter endings.",
  },
];

export function BookPage() {
  return (
    <>
      <section className="choir-page-hero" style={{ backgroundImage: `linear-gradient(180deg, hsl(296 100% 30% / 0.25), hsl(296 100% 20% / 0.72)), url(${choirMedia.bookHero})` }}>
        <div>
          <h1 className="choir-display">Make the moment undeniable</h1>
          <p style={{ maxWidth: "36rem" }}>
            Turn your gathering into a fully alive, participatory experience — where your people don’t just attend — they become the moment.
          </p>
          <Link className="choir-btn" href="/inquiry-form">
            Start an inquiry
          </Link>
        </div>
      </section>
      <div className="choir-logos">
        {LOGOS.map((logo) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={logo.alt} src={logo.src} alt={logo.alt} />
        ))}
      </div>
      <section className="choir-section choir-split">
        <div>
          <p>
            Crowdsource Choir delivers live, participatory entertainment for gatherings that want more than a speaker, a band, or another sit-and-listen experience.
          </p>
          <p>We create something shared, embodied, and alive — bringing people into connection and collective presence fast.</p>
          <h2 className="choir-display">When your crowd becomes the show</h2>
          <h3 className="choir-display" style={{ fontSize: "2rem" }}>What you’re really booking</h3>
          <p>You’re booking a guided experience that:</p>
          <ul>
            <li>brings a group into coherence</li>
            <li>lifts energy without hype</li>
            <li>invites participation without pressure</li>
            <li>creates a moment people actually feel</li>
          </ul>
          <p>It’s guided, not scripted. It unfolds in real time — shaped by the voices, energy, and ideas in the room.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.crowd21} alt="A crowd singing as the show" />
      </section>
      <section className="choir-section choir-split choir-theme-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.anthem} alt="A custom anthem written for a gathering" />
        <div>
          <h2 className="choir-display">Make your anthem</h2>
          <p>This is where it becomes undeniable.</p>
          <p>Every gathering has a purpose. A vision waiting to be embodied.</p>
          <p>
            We take words and stories from your group — the vision, values, and intent of the gathering — and give them voice through a custom anthem. Simple, powerful, and made to inspire.
          </p>
          <p>At the event, we bring it to life with the room itself.</p>
          <p>Your people don’t just experience the moment. They sing it.</p>
          <p className="choir-quote">“Joel is one of the Pacific Northwest’s most talented composers.”</p>
          <p>— American Songwriter</p>
        </div>
      </section>
      <section className="choir-section">
        <h2 className="choir-display">Listen to the anthem</h2>
        <iframe
          title="Crowdsource Choir anthem on SoundCloud"
          width="100%"
          height="166"
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          src="https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F2290053530&color=%23cfff81&inverse=false&auto_play=false&show_user=true"
        />
        <blockquote className="choir-quote">
          “Thank you again for that amazing anthem and the gift of what you brought to us, particularly in the unexpected moment we were having.”
        </blockquote>
      </section>
      <section className="choir-section choir-theme-purple">
        <h2 className="choir-display">A mode for every moment</h2>
        <p>Crowdsourced themes. Custom songs. Co-created live.</p>
        <div className="choir-modes">
          {MODES.map((mode) => (
            <article key={mode.title} className="choir-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mode.image} alt="" />
              <h3 className="choir-display">{mode.title}</h3>
              <p>{mode.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="choir-section choir-split">
        <div>
          <blockquote className="choir-quote">
            “Joel transformed the voices and stories of our guests into a beautiful, one-of-a-kind anthem that captured the spirit of our gathering. Singing it together was pure joy — a magical moment of connection and community that we’ll remember for years to come!”
          </blockquote>
          <h2 className="choir-display">Why this works</h2>
          <p>Singing together has been shown to:</p>
          <ul>
            <li>increase oxytocin, dopamine, and endorphins — supporting connection, joy, and well-being</li>
            <li>reduce stress by lowering cortisol and promoting mental clarity</li>
            <li>strengthen trust and social bonding</li>
            <li>improve memory, morale, and shared meaning</li>
          </ul>
          <p className="choir-quote">By the end, hundreds of us were singing, dancing, laughing, and making unforgettable memories.</p>
          <p>Organizer for a global conference</p>
          <p className="choir-quote">“The vibe was super high.”</p>
          <p>Microsoft corporate communications director</p>
          <p className="choir-quote">“Everyone had a blast.”</p>
          <p>Event producer, Seattle Art Museum</p>
          <p className="choir-quote">“We plan to do this again next year.”</p>
          <p>Vashon Island fundraiser</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.quote} alt="Guests singing a custom anthem" />
      </section>
      <section className="choir-page-hero" style={{ backgroundImage: `linear-gradient(180deg, hsl(0 0% 0% / 0.15), hsl(0 0% 0% / 0.55)), url(${choirMedia.ready})`, minHeight: "70vh" }}>
        <div>
          <h2 className="choir-display" style={{ fontSize: "clamp(3rem, 8vw, 6rem)", margin: 0 }}>
            Ready to book?
          </h2>
          <p>If you’re planning a gathering and want:</p>
          <ul>
            <li>entertainment with real engagement</li>
            <li>a shared uplifting musical moment</li>
            <li>something people talk about long after it ends</li>
          </ul>
          <p>Tell us a bit about your event, and we’ll take it from there.</p>
          <Link className="choir-btn" href="/inquiry-form">
            Inquiry form
          </Link>
        </div>
      </section>
    </>
  );
}
