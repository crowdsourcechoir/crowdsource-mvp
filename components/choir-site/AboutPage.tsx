import Link from "next/link";
import { choirMedia } from "@/lib/choir-site/media";

export function AboutPage() {
  return (
    <>
      <section className="choir-page-hero" style={{ backgroundImage: `url(${choirMedia.crowd15})` }}>
        <h1 className="choir-display">About</h1>
      </section>
      <section className="choir-section choir-split">
        <div>
          <p className="choir-eyebrow">How it began</p>
          <h2 className="choir-display">Strangers, a train car, a song</h2>
          <p>
            Born in 2017 with a call for strangers to sing in a crowded train car, Crowdsource Choir reimagined the
            choral experience — making it accessible, joyful, and irresistible for all.
          </p>
          <p>
            What started as a simple invitation became something more: a no-pressure, fun way for people to sing,
            sharing their own unique voice in harmony with others.
          </p>
          <p>Now it’s your turn.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.aboutMark} alt="" />
      </section>
      <section className="choir-section choir-theme-magenta">
        <p className="choir-eyebrow">Everyone belongs</p>
        <h2 className="choir-display">Your voice belongs here</h2>
        <p>
          Crowdsource Choir is a participatory music experience where voices come together in real time — dissolving
          the barrier between performer and audience.
        </p>
        <p>We gather to sing, to feel, and to reconnect through shared music making.</p>
        <p>Join us in a harmonious celebration as we raise the collective vibration in communal flashes of magnificence.</p>
      </section>
      <section className="choir-section choir-split">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.joel} alt="Joel DeJong leading a choir. Photo credit Nicole Pasia, Seattle Times." />
        <div>
          <p className="choir-eyebrow">The guide</p>
          <h2 className="choir-display">Joel DeJong</h2>
          <p>Seattle Times — photo credit Nicole Pasia</p>
          <p>
            At Crowdsource Choir, you experience the dynamism and vitalizing energy of founder and director Joel
            DeJong, who has a rare gift for transforming crowds into choirs.
          </p>
          <p>
            Joel is a musician, composer, and guide who exudes participation, presence, and joy. American Songwriter
            lauded Joel as “one of the Pacific Northwest’s most talented composers.”
          </p>
          <p>
            With a knack for infusing fun and accessibility into his work, Joel skillfully crafts arrangements of
            original and popular songs for audiences of all singing levels — ensuring that everyone can join in and
            enjoy the music.
          </p>
          <p>His role isn’t to perform for the room, but to inspire and guide what’s already in the room to come alive.</p>
        </div>
      </section>
      <section className="choir-section choir-split choir-theme-ink">
        <div>
          <p className="choir-eyebrow">The aim</p>
          <h2 className="choir-display">Singing, restored</h2>
          <p>
            With Crowdsource Choir, Joel aims to restore singing as a communal, cultural artform — something humans
            have always done together.
          </p>
          <p>
            Participating in this spirited experience fosters a sense of cultural renewal through collective creativity
            and music making: connection without pressure, joy without performance, and belonging without prerequisites.
          </p>
          <p>Every gathering is different. Every choir is temporary. Every sound is one of a kind. Every moment is magic.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.crowd10} alt="The choir in full voice" />
      </section>
      <section className="choir-section choir-split">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.ken} alt="Ken Nsimbi" />
        <div>
          <p className="choir-eyebrow">The heartbeat</p>
          <h2 className="choir-display">Ken Nsimbi</h2>
          <p>
            Ken Nsimbi has become a staple at Crowdsource Choir, providing rhythm and soul that keeps the choir in time
            and inspirited. Born and raised in Nairobi, Ken is a first generation immigrant in the U.S. His driving
            force is advocating for populations whose voices have been muted by society. He is committed to promoting
            equality for all and the fair redistribution of power and status to marginalized populations.
          </p>
          <p>
            Drums have been an intrinsic part of Ken’s life for decades and for countless generations before him, an
            ancient instrument used to celebrate all the aspects of life. Teaching African drumming is his way of
            inciting passion, inspiration, self-expression and healing in drummers on just about every continent on the
            planet.
          </p>
          <p>
            Ken invites you to hear the pulse of Africa’s soul, the hypnotic rhythms of the African drum beat with an
            intensity that transcends language, culture, and time. With each strike, it echoes the resilience, spirit,
            and vibrant traditions of a continent whose heartbeat resonates with the world.
          </p>
        </div>
      </section>
      <section className="choir-invite choir-theme-purple">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={choirMedia.kenJoel} alt="Ken and Joel" style={{ maxWidth: 720, margin: "0 auto 1.5rem" }} />
        <h2 className="choir-display">Raise the vibe with us</h2>
        <Link className="choir-btn" href="/book">
          Book
        </Link>
      </section>
    </>
  );
}
