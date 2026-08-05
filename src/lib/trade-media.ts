import builder from "@/assets/trade-builder.jpg";
import plumber from "@/assets/trade-plumber.jpg";
import electrician from "@/assets/trade-electrician.jpg";
import painter from "@/assets/trade-painter-decorator.jpg";
import carpenter from "@/assets/trade-carpenter.jpg";
import roofer from "@/assets/trade-roofer.jpg";
import plasterer from "@/assets/trade-plasterer.jpg";
import tiler from "@/assets/trade-tiler.jpg";
import gardener from "@/assets/trade-gardener.jpg";
import handyman from "@/assets/trade-handyman.jpg";
import street from "@/assets/street.jpg";

const map: Record<string, string> = {
  builder,
  plumber,
  electrician,
  "painter-decorator": painter,
  carpenter,
  roofer,
  plasterer,
  tiler,
  gardener,
  handyman,
};

/** Hero photo for a trade slug, falling back to a generic street shot. */
export function tradeHero(slug: string): string {
  return map[slug] ?? street;
}
