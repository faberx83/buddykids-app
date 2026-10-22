// TRAMA — RICERCA LUOGHI (21/10/2026, release "ricerca-luoghi").
// Fabrizio: "sulle scuole possiamo mettere un campo che si autocompleta con
// l'indirizzo? … stessa cosa per gli impegni personali". [no browser]

import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { buildPhotonUrl, parsePhotonResponse, placeLocationText } from "../../lib/places/search";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { FEATURE_CATALOG } from "../../lib/feature-registry/catalog";
import { getReleaseById } from "../../lib/releases/catalog";

const read = (p: string) => fs.readFileSync(path.join(__dirname, "../..", p), "utf-8");

const photon = {
  features: [
    {
      geometry: { coordinates: [9.1859, 45.4654] },
      properties: { name: "Scuola Primaria Pizzigoni", street: "Via Castellino da Castello", housenumber: "10", postcode: "20127", city: "Milano", countrycode: "IT", osm_key: "amenity", osm_value: "school" },
    },
    // doppione (stesso nome e indirizzo) → una volta sola
    {
      geometry: { coordinates: [9.1859, 45.4654] },
      properties: { name: "Scuola Primaria Pizzigoni", street: "Via Castellino da Castello", housenumber: "10", postcode: "20127", city: "Milano", countrycode: "IT", osm_key: "amenity", osm_value: "school" },
    },
    // fuori Italia → scartato
    { geometry: { coordinates: [8.5, 47.3] }, properties: { name: "Schule", city: "Zürich", countrycode: "CH" } },
    // senza coordinate → scartato
    { properties: { name: "Senza punto", countrycode: "IT" } },
    // indirizzo senza nome → nome = via
    { geometry: { coordinates: [9.2, 45.47] }, properties: { street: "Via Lamennais", housenumber: "8", city: "Milano", countrycode: "IT", osm_key: "place", osm_value: "house" } },
  ],
};

test.describe("TRAMA — Ricerca luoghi [no browser]", () => {
  test("RL-01 richiesta a Photon: almeno 3 lettere, solo Italia, scuole filtrate, niente dati di chi cerca", () => {
    expect(buildPhotonUrl({ q: "pi" })).toBeNull();
    const url = new URL(buildPhotonUrl({ q: "  scuola   pizzigoni ", kind: "school" })!);
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api/");
    expect(url.searchParams.get("q")).toBe("scuola pizzigoni");
    expect(url.searchParams.get("bbox")).toBe("6.6,35.4,18.6,47.1");
    expect(url.searchParams.getAll("osm_tag")).toEqual(["amenity:school", "amenity:kindergarten", "amenity:college"]);
    expect(new URL(buildPhotonUrl({ q: "palestra lamennais" })!).searchParams.getAll("osm_tag")).toEqual([]);
  });

  test("RL-02 risposta: nome + indirizzo italiano, senza doppioni né risultati esteri", () => {
    const r = parsePhotonResponse(photon);
    expect(r).toHaveLength(2);
    // 22/10/2026 (una sola Scuola per figlio): anche il Comune, per il calendario delle chiusure.
    expect(r[0]).toEqual({ name: "Scuola Primaria Pizzigoni", address: "Via Castellino da Castello 10, 20127 Milano", lat: 45.4654, lng: 9.1859, kind: "amenity:school", city: "Milano" });
    expect(r[1].name).toBe("Via Lamennais 8");
    expect(parsePhotonResponse(null)).toEqual([]);
    expect(placeLocationText(r[0])).toBe("Scuola Primaria Pizzigoni, Via Castellino da Castello 10, 20127 Milano");
    expect(placeLocationText(r[1])).toBe("Via Lamennais 8, Milano");
  });

  test("RL-03 route: solo utenti collegati con la release; errori = lista vuota; risposte in cache", () => {
    const route = read("app/api/places/search/route.ts");
    expect(route).toContain("if (!user) return NextResponse.json({ suggestions: [] }, { status: 401 });");
    expect(route).toContain("flagName: PLACE_SEARCH_FLAG,");
    expect(route).toContain(`cache: "force-cache",`);
    expect(route).toContain("signal: AbortSignal.timeout(4000),");
    expect(route.match(/^export /gm)).toHaveLength(1); // solo GET: le route di Next non accettano altri export
  });

  test("RL-04 campi: 'Dove' degli impegni e nome della scuola; coordinate salvate; attribuzione OSM", () => {
    expect(read("components/nextgen/ExternalPlannerItemsSection.tsx")).toContain("onPick={(p) => setForm((f) => ({ ...f, place: { lat: p.lat, lng: p.lng } }))}");
    const school = read("components/nextgen/SchoolHoursBlock.tsx");
    expect(school).toContain('kind="school"');
    expect(school).toContain("title: schoolName.trim() || \"Scuola\",");
    expect(read("components/nextgen/PlaceAutocomplete.tsx")).toContain("Indirizzi © OpenStreetMap");
    expect(read("lib/data/external-planner-items.ts")).toContain("meta.place = {");
  });

  test("RL-05 release: flag spento, voce di catalogo, pacchetto", () => {
    expect(FEATURE_FLAG_REGISTRY.PLACE_SEARCH_ENABLED.defaultValue).toBe(false);
    expect(FEATURE_CATALOG.find((f) => f.key === "place_search")?.releaseEligible).toBe(true);
    expect(getReleaseById("ricerca-luoghi")?.featureKeys).toEqual(["place_search"]);
  });
});
