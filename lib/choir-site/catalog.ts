import { choirImage } from "./media";

export type ChoirProduct = {
  slug: string;
  title: string;
  priceCents: number;
  summary: string;
  details: string[];
  colors: string[];
  sizes: string[];
  images: string[];
};

export const products: ChoirProduct[] = [
  {
    slug: "crowdsource-fitted-cottonpoly-t-shirt",
    title: "Crowdsource Fitted Cotton/Poly T-Shirt",
    priceCents: 3000,
    summary:
      "Our fitted cotton/poly tee should be a staple of everyone's wardrobe. These tees are perfect when worn on their own, and also a great layer. The cotton/poly blend makes for a durable wear and a form-fit that won't change after a few washes and dries.",
    details: [
      "Brand: Next Level",
      "60% cotton / 40% polyester | Fabric weight: 4.3 oz (midweight)",
      "Set-in 1x1 baby rib collar",
      "Tear-away label for added comfort",
      "Form-fitting silhouette",
      "Imported garment; processed and printed in the U.S.A.",
    ],
    colors: ["blush pink", "black"],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL"],
    images: [
      choirImage("1768328967236-ZUYNQ8OGC6OW6RYK8ZI7/69668f0532941c7aeb71ad88.png", 1200),
      choirImage("1768328967446-PRESDHKJO88SWPNOZHAF/69668f0532941c7aeb71ad88.png", 1200),
    ],
  },
  {
    slug: "vintage-washed-rope-cap",
    title: "Vintage Washed Rope Cap",
    priceCents: 3000,
    summary:
      "Embrace timeless style with the Vintage Washed Rope Cap. Whether you're hitting the streets or lounging in the sun, our Vintage Wash Cap adds a touch of nostalgia to any outfit.",
    details: [
      "Soft-structured, five-panel, mid-profile with braided rope",
      "Slightly curved recycled visor board",
      "100% pigment-dyed cotton",
      "Snapback closure",
      "Fabric weight: 5.0 oz (midweight)",
      "Brand: Legacy",
      "Imported product, printed and processed in the USA",
      "Normal fit",
    ],
    colors: ["washed black", "faded turquoise"],
    sizes: ["One Size"],
    images: [
      choirImage("1768329149027-FBCVIUAVCBO7JGP0MS9F/69668fba3fafa24312754031.png", 1200),
      choirImage("1768329149033-2DD8FTRKFEHQFF8MYSUP/69668fba3fafa24312754031.png", 1200),
    ],
  },
  {
    slug: "crowdsource-crewneck-sweatshirt",
    title: "Crowdsource Crewneck Sweatshirt",
    priceCents: 4000,
    summary:
      "This classic has stood the test of time. Always in fashion, this crewneck sweatshirt by Gildan is perfect as an outer, under, or single layer. Soft and comfortable, this stand-by is a must.",
    details: [
      "Brand: Gildan",
      "50% preshrunk cotton / 50% polyester | Fabric weight: 7.75 oz (midweight)",
      "Pill-resistant",
      "1X1 Lycra spandex ribbed collar, cuffs and waist",
      "Fully double-stitched",
      "Imported; processed and printed in the U.S.A.",
    ],
    colors: ["black"],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
    images: [choirImage("1768329216967-ZYFXEK7Q8KCJWJ7S8YEY/69668ffef90f0c35602ce359.png", 1200)],
  },
  {
    slug: "crowdsource-unisex-joggers",
    title: "Crowdsource Unisex Joggers",
    priceCents: 4000,
    summary:
      "These ultra-comfy mid-weight unisex joggers are ideal for lounging at home or keeping you warm for your workout. No matter your style, these cozy joggers are an essential basic.",
    details: [
      "60% cotton / 40% polyester | Fabric weight: 7.2 oz (midweight)",
      "Tapered leg for a modern fit",
      "Elastic waistband with drawcord",
      "Charcoal grey contrast drawcord and side-entry pockets",
      "Imported; processed and printed in the U.S.A.",
    ],
    colors: ["black/asphalt"],
    sizes: ["S", "M", "L", "XL", "2XL"],
    images: [
      choirImage("1768329412466-KTIY2052GJTFRGYXN5BD/696690c23fafa2431275421a.png", 1200),
      choirImage("1768329412558-JGY44P5N9BO4Z2FMDPSQ/696690c23fafa2431275421a.png", 1200),
    ],
  },
  {
    slug: "hoodie",
    title: "Hoodie",
    priceCents: 4000,
    summary:
      "This Hanes classic is a comfortable classic. King of versatility, the hooded sweatshirt has become a staple in any wardrobe. The kangaroo-style front pocket is perfect for your phone, keys, or anything else you want to stash.",
    details: [
      "Brand: Hanes",
      "Made with up to 5% recycled polyester from plastic bottles",
      "Kangaroo-style front pocket",
      "Imported; processed and printed in the U.S.A.",
    ],
    colors: ["black", "pale pink", "safety green", "white"],
    sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"],
    images: [
      choirImage("1773696666907-MK93K7GI0WN8GJMD9H41/69b87699efe8953e05fc2184.png", 1200),
      choirImage("1773696667187-JSQ6L96ITYV3RFS3FEVL/69b87699efe8953e05fc2184.png", 1200),
      choirImage("1773696667029-GLEP04TKCSRDCWTQPEMD/69b87699efe8953e05fc2184.png", 1200),
      choirImage("1773696667152-USC1USNOTM91W2DF6ROF/69b87699efe8953e05fc2184.png", 1200),
    ],
  },
  {
    slug: "flexfit-fitted-cap",
    title: "Flexfit Fitted Cap",
    priceCents: 2500,
    summary:
      "Top off your casual look with the baseball cap for all. With a closed back and stretch fit band for maximum comfort, it’s the perfect cap for running errands or simply hanging out in the sun.",
    details: [
      "Closed back, stretch fitted",
      "Permacurv visor with silver undervisor",
      "8-row stitching on visor",
      "5-panel",
    ],
    colors: ["black"],
    sizes: ["S/M Cap", "L/XL Cap"],
    images: [choirImage("1773766068473-YF1EHIKYYZJRXU6WFOGC/69b985b29be9a7021f0d8819.png", 1200)],
  },
];

export function productBySlug(slug: string): ChoirProduct | undefined {
  return products.find((product) => product.slug === slug);
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
