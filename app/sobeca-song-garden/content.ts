export type CopyBlock =
  | { type: "kicker"; text: string }
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "line"; text: string }
  | { type: "image"; src: string; alt: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "list"; items: string[] };

export type PitchSlide = {
  id: string;
  image: string;
  imageAlt: string;
  blocks: CopyBlock[];
};

export const slides: PitchSlide[] = [
  {
    id: "title",
    image: "/sobeca-song-garden/sobeca-hero-district.jpg",
    imageAlt: "A walkable creative district street at dusk",
    blocks: [
      { type: "title", text: "SoBECA Song Garden" },
      { type: "kicker", text: "A Living Participatory Arts Initiative" },
      { type: "line", text: "Inspiring Creativity Public Launch" },
      { type: "paragraph", text: "Presenting the SoBECA Song Garden, created by Crowdsource Choir" },
    ],
  },
  {
    id: "what-if",
    image: "/sobeca-song-garden/sobeca-hero-voices.jpg",
    imageAlt: "People singing together outdoors",
    blocks: [
      { type: "heading", text: "What if creativity became something the whole district could participate in?" },
      {
        type: "paragraph",
        text: "The SoBECA Song Garden is a living participatory arts initiative designed to accelerate and amplify the communal creativity throughout the arts district—creating new opportunities for connection, creative expression, collaboration, and moments of collective effervescence.",
      },
      {
        type: "paragraph",
        text: "At the center is Song Garden, an established participatory experience created by Crowdsource Choir. It invites people into the creative process through song seeds: words, stories, voices, sounds, images, and reflections inspired by seasonal themes and place.",
      },
      {
        type: "paragraph",
        text: "Those contributions become shared creative source material. Crowdsource Choir curates what emerges from the Garden and collaborates with local artists across disciplines—music, visual art, film, projection, movement, poetry, installation, and more—to interpret and transform that material into new work.",
      },
      {
        type: "paragraph",
        text: "Created by Crowdsource Choir, Song Garden continues to evolve through participation and its application in different communities, gatherings, and places. In SoBECA, the experience extends into the physical district through businesses, venues, creative activations, installations, projections, gatherings, and other invitations to participate—creating multiple pathways into one shared participatory experience.",
      },
      { type: "paragraph", text: "In this way, the community becomes more than an audience." },
      { type: "paragraph", text: "It becomes a creative source." },
      {
        type: "paragraph",
        text: "The initiative launches publicly in November 2026, as Inspiring Creativity introduces itself to the community by presenting the first SoBECA Song Garden Bloom. The gathering will bring together artists, businesses, venues, community leaders, funders, partners, and participants to experience what has begun growing—and invite them to help shape and support what comes next.",
      },
    ],
  },
  {
    id: "participate",
    image: "/sobeca-song-garden/sobeca-hero-camp.jpg",
    imageAlt: "A grassy courtyard between low buildings",
    blocks: [
      { type: "heading", text: "How the Community Can Participate" },
      {
        type: "paragraph",
        text: "The Song Garden is designed with many entry points. People and organizations can participate according to what they have to contribute—creativity, space, relationships, expertise, resources, funding, or simply their own voice.",
      },
      {
        type: "table",
        headers: ["If you are…", "You can participate by…"],
        rows: [
          [
            "Community Member",
            "Planting Song Seeds, attending Blooms, sharing stories and ideas, responding to prompts, and inviting others into the Garden.",
          ],
          [
            "Artist / Creative",
            "Responding to Song Garden material, creating new work, collaborating across disciplines, contributing to activations, and participating in future Blooms.",
          ],
          [
            "Business",
            "Becoming a node in the Garden, inviting customers and employees to participate, providing space or resources, hosting activations, and supporting the initiative financially or in-kind.",
          ],
          [
            "Venue / Property Owner",
            "Providing places for Blooms, installations, pop-ups, artist work, community gatherings, and other expressions of the Garden.",
          ],
          [
            "Community Leader / Connector",
            "Bringing communities and networks into the Garden, identifying opportunities for participation, making introductions, and helping the initiative reach people throughout SoBECA.",
          ],
          [
            "Creative / Production Partner",
            "Contributing expertise, technology, equipment, fabrication, design, production, documentation, communications, or other capabilities that help bring ideas to life.",
          ],
          [
            "Funder / Sponsor / Donor",
            "Funding artist commissions, Blooms, community participation, creative development, infrastructure, and the continued growth of the initiative.",
          ],
          [
            "Volunteer / Contributor",
            "Giving time, skills, materials, equipment, hospitality, professional services, or other in-kind resources that help the Garden grow.",
          ],
        ],
      },
      {
        type: "paragraph",
        text: "There is no single way to participate. The invitation is to bring what you have—and help grow what comes next.",
      },
    ],
  },
  {
    id: "regenerative",
    image: "/sobeca-song-garden/sobeca-hero-garden.jpg",
    imageAlt: "An outdoor listening garden in a courtyard",
    blocks: [
      { type: "heading", text: "A Regenerative Model for Growth" },
      {
        type: "paragraph",
        text: "The SoBECA Song Garden is being designed as a living system—not only in the art it creates, but in how the initiative itself develops.",
      },
      {
        type: "paragraph",
        text: "Rather than building a large permanent organization around a predetermined program, a small core team will steward the purpose, relationships, creative framework, resources, and continuity of the initiative.",
      },
      { type: "paragraph", text: "Around each Bloom, the system expands." },
      {
        type: "paragraph",
        text: "Artists, producers, designers, technologists, community leaders, businesses, venues, volunteers, and other collaborators come together according to what that particular growing cycle calls for. Funding, expertise, relationships, spaces, equipment, materials, and creative energy can be drawn into the system as needed.",
      },
      { type: "paragraph", text: "The Bloom concentrates that energy into a shared creative expression." },
      {
        type: "paragraph",
        text: "Afterward, the temporary structure can dissipate—but what it generated remains: new creative work, stronger relationships, documentation, learning, community participation, new collaborators, greater visibility, additional resources, and possibilities for the next cycle.",
      },
      { type: "paragraph", text: "The organization does not need to remain large for the work to become large." },
      {
        type: "paragraph",
        text: "This regenerative approach allows the SoBECA initiative to remain adaptive to place, people, participation, available resources, and what is actually emerging—while retaining the capacity to create increasingly ambitious multidisciplinary experiences.",
      },
    ],
  },
  {
    id: "cycle",
    image: "/sobeca-song-garden/sobeca-hero-night.jpg",
    imageAlt: "An arts district street in the evening",
    blocks: [
      { type: "heading", text: "The Growing Cycle" },
      {
        type: "table",
        headers: ["Phase", "What Happens"],
        rows: [
          [
            "PLANT",
            "Invite participation. Establish a theme or inquiry. Activate partners and places. Begin gathering Song Seeds.",
          ],
          [
            "GROW",
            "Contributions accumulate. Relationships form. Artists begin responding. Opportunities, resources, and creative directions emerge.",
          ],
          [
            "GATHER",
            "A team forms around what the cycle requires. Artists, producers, partners, spaces, funding, technology, and other resources are brought together.",
          ],
          [
            "BLOOM",
            "The accumulated creative and community energy becomes a shared participatory experience.",
          ],
          [
            "RETURN",
            "Creative work, stories, documentation, learning, relationships, and resources are returned to the community and the larger Garden.",
          ],
          [
            "REGENERATE",
            "The system evaluates what emerged, retains what creates lasting value, releases what is no longer needed, and creates the conditions for another cycle to begin.",
          ],
        ],
      },
      {
        type: "image",
        src: "/sobeca-song-garden/cycle-loop.png",
        alt: "Plant, grow, gather, bloom, return, regenerate",
      },
    ],
  },
  {
    id: "november",
    image: "/sobeca-song-garden/sobeca-hero-warehouse.jpg",
    imageAlt: "An intimate choir show inside a warehouse",
    blocks: [
      { type: "heading", text: "November: The First Bloom" },
      {
        type: "paragraph",
        text: "The November 2026 public launch of Inspiring Creativity, presenting the SoBECA Song Garden, becomes the first opportunity to put this model into practice.",
      },
      {
        type: "paragraph",
        text: "With approximately seven weeks to launch, the goal is not to build a permanent organization or a fully realized version of the SoBECA Song Garden.",
      },
      { type: "paragraph", text: "The goal is to assemble the capacity required for this first cycle." },
      {
        type: "paragraph",
        text: "A focused team will form around the November launch, bringing together the people, relationships, creative disciplines, resources, and production capabilities necessary to create the first Bloom.",
      },
    ],
  },
  {
    id: "core",
    image: "/sobeca-song-garden/sobeca-hero-core.jpg",
    imageAlt: "A small team planning in a warehouse studio",
    blocks: [
      { type: "heading", text: "The Core" },
      { type: "paragraph", text: "At the center is a small stewarding team:" },
      {
        type: "table",
        headers: ["Core Role", "Responsibility"],
        rows: [
          [
            "Inspiring Creativity",
            "Holds the nonprofit and community container: organizational stewardship, fundraising, local relationships, partnerships, and community convening.",
          ],
          [
            "Crowdsource Choir",
            "Serves as Initiative + Creative Lead and brings its established Song Garden experience and methodology to SoBECA—leading creative direction, participation design, curation, artist integration, music, and Bloom experience development.",
          ],
          [
            "Program / Production Leadership",
            "Translates the evolving vision into executable plans and coordinates the people, resources, schedules, budgets, and production required to bring each cycle to life.",
          ],
        ],
      },
      { type: "paragraph", text: "This core provides continuity from one cycle to the next." },
    ],
  },
  {
    id: "bloom-team",
    image: "/sobeca-song-garden/sobeca-hero-crew.jpg",
    imageAlt: "Artists and a crew setting up inside a warehouse",
    blocks: [
      { type: "heading", text: "The November Bloom Team" },
      {
        type: "paragraph",
        text: "Around that core, a larger team forms specifically for the November launch. Depending on what the experience requires, that may include:",
      },
      {
        type: "list",
        items: [
          "Event Producer / Planner",
          "Production and technical partners",
          "Local artists and creative collaborators",
          "Community leads and connectors",
          "Participating businesses and venues",
          "Communications and design",
          "Photography, film, and storytelling",
          "Hospitality and guest experience",
          "Volunteers",
          "Sponsors, donors, and in-kind contributors",
          "Specialized creative, technical, or production collaborators",
        ],
      },
      {
        type: "paragraph",
        text: "Not every role needs to become a permanent position, and not every role needs to be filled through cash investment. Some capacity can come through partnerships, donated expertise, shared resources, volunteer participation, and in-kind contributions.",
      },
      { type: "paragraph", text: "What matters is that the right capacity comes together around the work at the right time." },
    ],
  },
  {
    id: "catalyst",
    image: "/sobeca-song-garden/sobeca-hero-after.jpg",
    imageAlt: "People lingering together after a gathering",
    blocks: [
      { type: "heading", text: "November as a Catalyst" },
      {
        type: "paragraph",
        text: "The November launch should be evaluated not only by the experience it produces, but by what it generates for the system afterward.",
      },
      {
        type: "paragraph",
        text: "A successful launch leaves Inspiring Creativity and the SoBECA Song Garden with more capacity than they had before the event:",
      },
      {
        type: "list",
        items: [
          "More participants.",
          "More relationships.",
          "More artists.",
          "More creative material.",
          "More community ownership.",
          "More partners.",
          "More resources.",
          "More visibility.",
          "More knowledge.",
          "More possibilities.",
        ],
      },
      {
        type: "paragraph",
        text: "The people gathered in November are therefore not simply an audience for the launch. They are potential participants in the next growing cycle.",
      },
      {
        type: "paragraph",
        text: "Some may contribute creatively. Some may host. Some may fund. Some may provide equipment, materials, expertise, space, or services. Some may join a future Bloom team. Some may connect the initiative to another part of the community.",
      },
      {
        type: "paragraph",
        text: "The launch is designed to convert the energy generated by the gathering into capacity for what comes next.",
      },
      { type: "paragraph", text: "That becomes a guiding principle for the initiative:" },
      {
        type: "line",
        text: "Each cycle should leave the Garden richer in relationships, creativity, capacity, and possibility than it was before.",
      },
    ],
  },
  {
    id: "building",
    image: "/sobeca-song-garden/sobeca-hero-projection.jpg",
    imageAlt: "Projections across creative-district warehouses at night",
    blocks: [
      { type: "heading", text: "What We’re Building Toward" },
      {
        type: "paragraph",
        text: "November plants the conditions. The larger opportunity is for the SoBECA Song Garden to become an ongoing creative system embedded throughout the district—connecting people, artists, businesses, venues, spaces, and resources through a continually evolving cycle of participation and creation.",
      },
      {
        type: "paragraph",
        text: "As the Garden grows, more people contribute. More places become entry points. More artists work with what emerges. New collaborations form. Each Bloom creates new work, relationships, resources, learning, and possibilities that feed the next growing cycle.",
      },
      { type: "paragraph", text: "Over time, this could include:" },
      {
        type: "list",
        items: [
          "A growing network of Song Garden nodes throughout SoBECA—businesses, venues, gathering places, installations, and other spaces where people can encounter and participate in the Garden.",
          "Ongoing community participation through digital and physical invitations that continually generate new stories, voices, sounds, images, ideas, and other creative source material.",
          "A growing community of artists and collaborators working across disciplines and responding to both the Garden and one another.",
          "Increasingly ambitious Blooms that can range from intimate gatherings and pop-ups to larger multidisciplinary experiences spanning multiple spaces throughout the district.",
          "A persistent physical and digital presence that makes the Garden visible between Blooms and creates new ways for people to encounter, contribute to, and experience what is growing.",
          "Creative work that returns to the community through music, installations, films, projections, performances, stories, public art, digital experiences, and other forms.",
          "An expanding ecosystem of partners and resources—businesses, venues, funders, sponsors, civic partners, production partners, volunteers, and in-kind contributors who help increase what the system is capable of producing.",
        ],
      },
      { type: "paragraph", text: "The goal is not simply to produce more events." },
      {
        type: "paragraph",
        text: "It is to cultivate an increasingly connected and capable creative ecosystem—one in which participation generates creative material, creative material generates collaboration, collaboration generates shared experiences, and those experiences generate new participation, relationships, and resources.",
      },
      {
        type: "paragraph",
        text: "As the ecosystem becomes stronger, the scope of what it can create can become larger and more ambitious without requiring a permanently larger organization.",
      },
      { type: "paragraph", text: "The Garden grows by increasing the creative capacity of the system around it." },
    ],
  },
  {
    id: "growing",
    image: "/sobeca-song-garden/sobeca-hero-expand.jpg",
    imageAlt: "Installations along a walkable arts-district street",
    blocks: [
      { type: "heading", text: "Growing the Garden" },
      {
        type: "paragraph",
        text: "The SoBECA Song Garden is intended to grow through successive cycles of participation, creation, learning, and regeneration rather than according to a fixed blueprint.",
      },
      {
        type: "paragraph",
        text: "Each cycle provides an opportunity to deepen participation, strengthen relationships, expand creative capacity, test new possibilities, and discover what the Garden can become next.",
      },
      { type: "paragraph", text: "The direction is clear even if the exact path remains adaptive." },
      {
        type: "table",
        headers: ["Stage", "Focus", "What Could Grow"],
        rows: [
          [
            "Establish",
            "Build the rhythm and strengthen the roots.",
            "Recurring Song Garden cycles and Blooms; growing community participation; an initial network of businesses and venues; multidisciplinary artist collaborations; strong production and community partnerships; experimentation with physical and digital expressions of the Garden.",
          ],
          [
            "Expand",
            "Increase participation, connectivity, and creative ambition.",
            "More nodes throughout SoBECA; broader artist participation; more persistent physical and digital experiences; increasingly ambitious Blooms; collaborations across multiple locations; deeper business, civic, cultural, and funding partnerships.",
          ],
          [
            "Integrate",
            "Become increasingly embedded in the cultural life of the district.",
            "Song Garden activity throughout the year; interconnected creative experiences across SoBECA; stronger pathways between community contributions and artist work; larger multidisciplinary collaborations; new forms of public participation and shared cultural expression.",
          ],
          [
            "Regenerate",
            "Build the capacity for the system to continually generate what comes next.",
            "A mature network of participants, artists, places, partners, resources, and creative infrastructure; ambitious district-wide Blooms alongside smaller emergent activity; a system that continually renews participation, relationships, resources, and creative possibility.",
          ],
        ],
      },
      {
        type: "paragraph",
        text: "Growth is measured not by more events, more staff, or a larger permanent organization, but by the creative capacity of the ecosystem: more people participating, more artists creating, more places activating the Garden, and more relationships and resources available when opportunities emerge.",
      },
      {
        type: "paragraph",
        text: "As that capacity grows, increasingly ambitious teams and experiences can form around each Bloom and then release back into the ecosystem.",
      },
      {
        type: "paragraph",
        text: "The goal is a more creative, connected, and regenerative SoBECA—capable of continually generating new possibilities from within.",
      },
    ],
  },
  {
    id: "invitation",
    image: "/sobeca-song-garden/sobeca-hero-blooms.jpg",
    imageAlt: "Blooms along a creative district street",
    blocks: [
      { type: "heading", text: "An Invitation to Create Together" },
      {
        type: "paragraph",
        text: "The SoBECA Song Garden begins with the founding leadership of Inspiring Creativity and Crowdsource Choir, but its potential lives in the people, artists, relationships, places, and creative energy already present throughout SoBECA.",
      },
      {
        type: "paragraph",
        text: "Creating is part of what it means to be human. Yet much of that creative capacity remains untapped or disconnected. The Song Garden creates conditions for it to emerge—transforming individual creative potential into collective expression.",
      },
      {
        type: "paragraph",
        text: "That is the deeper purpose of the initiative: to grow the creative capacity of the SoBECA district itself.",
      },
      {
        type: "paragraph",
        text: "Not simply by producing more art, but by creating more connections between people and ideas. More opportunities to contribute and collaborate. More willingness to experiment and risk together. More pathways for what emerges to become the source material for what comes next.",
      },
      {
        type: "paragraph",
        text: "In a choir, no single voice creates the whole. Each voice adds something distinct, and what emerges belongs to everyone.",
      },
      {
        type: "paragraph",
        text: "The Song Garden seeks to awaken that same possibility throughout SoBECA—to awaken the choir that is already there.",
      },
      { type: "paragraph", text: "Individual creativity becomes collective expression." },
      { type: "paragraph", text: "Collective expression strengthens connection." },
      { type: "paragraph", text: "Connection creates the conditions for more creativity to emerge." },
      {
        type: "line",
        text: "That is how we grow the SoBECA Song Garden and renew culture—by creating it together.",
      },
    ],
  },
];
