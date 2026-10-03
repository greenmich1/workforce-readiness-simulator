"use client";
/**
 * The front screen's globe (2026-10-03): the same CesiumJS planet as Maritime OS (NASA Blue Marble
 * from GIBS, no Cesium ion, transparent over the family's milk page), with the sites as pins.
 *
 * It is driven, not interactive in its own right: the page says which region to show (`view`) and which
 * site is hot, and the globe flies there. A visitor can still drag it on a desktop and click a pin.
 * Cesium is loaded as the global build from /cesium (copied there by `postinstall`), as Maritime does,
 * so it stays out of the Next bundle and loads only on this screen.
 */
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { SITES, type Site } from "@/lib/sites";
import { EXPORT_PLANTS, HOME, type Mode, type Region } from "@/lib/regions";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { Cesium?: any; CESIUM_BASE_URL?: string } }

export interface GlobeHandle {
  /** Where a place is on the page (CSS pixels, viewport coordinates), or null when it is behind the planet. */
  project(lat: number, lon: number): { x: number; y: number } | null;
}

let loading: Promise<any> | null = null;
function loadCesium(): Promise<any> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (loading) return loading;
  window.CESIUM_BASE_URL = "/cesium";
  loading = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "/cesium/Cesium.js"; js.async = true;
    js.onload = () => resolve(window.Cesium);
    js.onerror = () => { loading = null; reject(new Error("Cesium failed to load")); };
    document.head.appendChild(js);
  });
  return loading;
}

const INK = "#0B2545";
const COLOUR: Record<string, string> = { manufacturing: "#00539B", research: "#5A3FD4", office: "#0072AE" };

/** A great-circle arc from a plant to an office, lifted in the middle (as Maritime lifts its lanes). */
function arcPositions(C: any, from: Site, to: Site, n = 72): any[] {
  const a = C.Cartographic.fromDegrees(from.lon, from.lat);
  const b = C.Cartographic.fromDegrees(to.lon, to.lat);
  const geo = new C.EllipsoidGeodesic(a, b);
  const lift = Math.min(geo.surfaceDistance * 0.075, 1_100_000);
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = geo.interpolateUsingFraction(t);
    out.push(C.Cartesian3.fromRadians(p.longitude, p.latitude, Math.sin(Math.PI * t) * lift));
  }
  return out;
}

interface Props {
  /** Not `ref`: next/dynamic's wrapper is safest passing an ordinary prop. */
  handle?: Ref<GlobeHandle>;
  mode: Mode;
  /** The region to frame, or null for the view's home. */
  view: Region | null;
  /** The site to lift (hovered row). */
  hot: string | null;
  reducedMotion: boolean;
  /** Phones: the globe is a picture, so touch scrolls the page instead of spinning the planet. */
  still: boolean;
  onReady?: () => void;
  onPick?: (siteId: string) => void;
}

export default function SiteGlobe({ handle, mode, view, hot, reducedMotion, still, onReady, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const g = useRef<any>(null); // { C, widget, pins, labels, arcs, comets, byId }
  const props = useRef({ mode, view, hot, reducedMotion, onPick, onReady });
  props.current = { mode, view, hot, reducedMotion, onPick, onReady };

  useImperativeHandle(handle, () => ({
    project(lat, lon) {
      const s = g.current;
      if (!s) return null;
      const { C, widget } = s;
      const scene = widget.scene;
      const world = C.Cartesian3.fromDegrees(lon, lat);
      const occluder = new C.EllipsoidalOccluder(C.Ellipsoid.WGS84, scene.camera.positionWC);
      if (!occluder.isPointVisible(world)) return null;
      const toWindow = C.SceneTransforms.worldToWindowCoordinates ?? C.SceneTransforms.wgs84ToWindowCoordinates;
      const p = toWindow(scene, world);
      if (!p) return null;
      const r = scene.canvas.getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    },
  }), []);

  // Build once.
  useEffect(() => {
    let dead = false;
    let raf = 0;
    loadCesium().then((C) => {
      if (dead || !host.current) return;
      const dpr = window.devicePixelRatio || 1;
      const widget = new C.CesiumWidget(host.current, {
        baseLayer: false,
        skyBox: false,
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,
        useBrowserRecommendedResolution: false,
        creditContainer: credits.current ?? undefined,
        contextOptions: { webgl: { alpha: true } },
      });
      widget.resolutionScale = Math.min(dpr, 2) / dpr;
      const scene = widget.scene;
      scene.backgroundColor = C.Color.TRANSPARENT;
      // No sky atmosphere: on the transparent page it draws a dark ring round the limb (Maritime's day
      // look has none either).
      scene.skyAtmosphere.show = false;
      scene.globe.showGroundAtmosphere = false;
      // Blue Marble's own open-ocean blue, so the hairline the tiles leave at 180° doesn't show.
      scene.globe.baseColor = C.Color.fromBytes(16, 44, 91);
      scene.fog.enabled = true;
      if (scene.sun) scene.sun.show = false;
      if (scene.moon) scene.moon.show = false;

      // Natural Earth (on disk) paints at once; NASA's Blue Marble tiles land on top of it.
      const natural = C.ImageryLayer.fromProviderAsync(
        C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl("Assets/Textures/NaturalEarthII")),
      );
      widget.imageryLayers.add(natural);
      const marble = new C.ImageryLayer(new C.UrlTemplateImageryProvider({
        // WMTS REST is z/y/x (row before column), as Maritime's basemaps.ts notes.
        url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg",
        tilingScheme: new C.WebMercatorTilingScheme(),
        maximumLevel: 8,
        credit: "Blue Marble · NASA EOSDIS GIBS",
      }));
      // The tiles carry a dark hairline at 180°, just east of New Zealand. Cut it out; once Natural Earth is
      // hidden (below) the sliver shows the base colour, which is Blue Marble's ocean there.
      marble.cutoutRectangle = C.Rectangle.fromDegrees(179.94, -90, 180, 90);
      widget.imageryLayers.add(marble);

      const ctl = scene.screenSpaceCameraController;
      ctl.minimumZoomDistance = 150_000;
      ctl.maximumZoomDistance = 30_000_000;
      if (still) ctl.enableInputs = false;

      const pins = scene.primitives.add(new C.PointPrimitiveCollection());
      const arcs = scene.primitives.add(new C.PolylineCollection());
      const comets = scene.primitives.add(new C.PointPrimitiveCollection());
      const labels = scene.primitives.add(new C.LabelCollection());
      const byId = new Map<string, any>();
      for (const s of SITES) {
        const p = pins.add({
          id: s.id,
          position: C.Cartesian3.fromDegrees(s.lon, s.lat),
          pixelSize: 8,
          color: C.Color.fromCssColorString(COLOUR[s.kind]),
          outlineColor: C.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: 0,
        });
        byId.set(s.id, p);
      }

      // One arc per office, from the major plants in turn, so the network reads as exports.
      const offices = SITES.filter((s) => s.kind === "office");
      const arcList = offices.map((o, i) => {
        const from = EXPORT_PLANTS[i % EXPORT_PLANTS.length];
        const positions = arcPositions(C, from, o);
        const line = arcs.add({
          positions, width: 3,
          material: C.Material.fromType("PolylineGlow", { color: C.Color.fromCssColorString("#00AEEF").withAlpha(0.55), glowPower: 0.18, taperPower: 1 }),
        });
        const comet = comets.add({ position: positions[0], pixelSize: 5, color: C.Color.WHITE, outlineColor: C.Color.fromCssColorString("#00AEEF"), outlineWidth: 2 });
        return { office: o.id, positions, line, comet, phase: i / offices.length };
      });

      g.current = { C, widget, pins, labels, arcs, comets, byId, arcList };

      // Click a pin to open its site; the cursor says when a pin is under it.
      const handler = new C.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((e: any) => {
        const hit = scene.pick(e.position);
        if (hit?.id && typeof hit.id === "string" && byId.has(hit.id) && byId.get(hit.id).show) props.current.onPick?.(hit.id);
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      handler.setInputAction((e: any) => {
        const hit = scene.pick(e.endPosition);
        scene.canvas.style.cursor = hit?.id && typeof hit.id === "string" && byId.get(hit.id)?.show ? "pointer" : "";
      }, C.ScreenSpaceEventType.MOUSE_MOVE);
      g.current.handler = handler;

      // Ready when the first full set of tiles is in (or after 8 s, so a slow tile never keeps the poster up).
      let readied = false;
      const ready = () => {
        if (readied) return;
        readied = true; off();
        natural.show = false; scene.requestRender();
        props.current.onReady?.();
      };
      const off = scene.globe.tileLoadProgressEvent.addEventListener((n: number) => { if (n === 0 && scene.globe.tilesLoaded) ready(); });
      setTimeout(ready, 8000);

      // The comets only move in the offices view, and only with motion allowed.
      const tick = (t: number) => {
        raf = requestAnimationFrame(tick);
        const s = g.current;
        if (!s || props.current.mode !== "office" || props.current.reducedMotion || document.hidden) return;
        for (const a of s.arcList) {
          const f = ((t / 5200 + a.phase) % 1);
          a.comet.position = a.positions[Math.floor(f * (a.positions.length - 1))];
        }
        scene.requestRender();
      };
      raf = requestAnimationFrame(tick);

      apply(true);
    }).catch(() => { /* the poster stays; the list still works */ });
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      const s = g.current;
      g.current = null;
      if (s) { s.handler?.destroy(); s.widget.destroy(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Show the right pins, labels and arcs for the state, and fly to the view. */
  function apply(first = false, fly = true) {
    const s = g.current;
    if (!s) return;
    const { C, widget, byId, labels, arcList } = s;
    const { mode, view, hot, reducedMotion } = props.current;
    const inView = new Set(view?.sites.map((x) => x.id) ?? []);

    for (const site of SITES) {
      const p = byId.get(site.id);
      const ofMode = mode === "office" ? site.kind === "office" : site.kind !== "office";
      // In the offices view the major plants stay as the arcs' origins.
      const origin = mode === "office" && site.scale === "large";
      p.show = ofMode || origin;
      const base = site.kind === "office" ? 9 : site.scale === "large" ? 12 : site.kind === "research" ? 10 : 8;
      const lit = !view || inView.has(site.id);
      p.pixelSize = site.id === hot ? base + 8 : origin ? 6 : base;
      p.color = C.Color.fromCssColorString(origin ? "#00AEEF" : COLOUR[site.kind]).withAlpha(lit || origin ? 1 : 0.45);
      p.outlineWidth = site.id === hot ? 3 : 2;
    }

    labels.removeAll();
    // A crowded region (Waikato's eight plants within 40 km, or Kapuni and Eltham 10 km apart) names only
    // its major plants and the hovered site; the list beside the globe names the rest.
    const vs = view?.sites ?? [];
    const crowded = vs.length > 5 || vs.some((a, i) => vs.slice(i + 1).some((b) => Math.hypot(a.lat - b.lat, a.lon - b.lon) < 0.2));
    for (const site of view?.sites ?? []) {
      if (crowded && site.id !== hot && site.scale !== "large") continue;
      labels.add({
        position: C.Cartesian3.fromDegrees(site.lon, site.lat),
        text: site.name,
        font: `600 ${site.id === hot ? 13.5 : 12}px Figtree, system-ui, sans-serif`,
        fillColor: C.Color.WHITE,
        showBackground: true,
        backgroundColor: C.Color.fromCssColorString(INK).withAlpha(site.id === hot ? 0.9 : 0.66),
        backgroundPadding: new C.Cartesian2(7, 4),
        horizontalOrigin: C.HorizontalOrigin.LEFT,
        verticalOrigin: C.VerticalOrigin.CENTER,
        pixelOffset: new C.Cartesian2(12, 0),
      });
    }

    for (const a of arcList) {
      const show = mode === "office";
      a.line.show = show; a.comet.show = show && !reducedMotion;
      const lit = !view || inView.has(a.office);
      a.line.material.uniforms.color = C.Color.fromCssColorString("#00AEEF").withAlpha(lit ? 0.7 : 0.18);
      a.line.width = lit && view ? 4.5 : 3;
    }

    if (!fly) { widget.scene.requestRender(); return; }
    // The camera: the region's centre, from a range that fits its spread, tilted a little so the
    // planet has a horizon. A bounding sphere keeps the target centred whatever the tilt.
    let lon: number, lat: number, range: number, pitch: number;
    if (view) {
      lon = view.lon; lat = view.lat;
      const km = view.span * 111_000;
      range = mode === "office"
        ? Math.min(Math.max(km * 3 + 2_600_000, 3_400_000), 9_000_000)
        : Math.min(Math.max(km * 3.8 + 260_000, 480_000), 2_600_000);
      pitch = mode === "office" ? -68 : -58;
    } else {
      [lon, lat, range] = HOME[mode];
      pitch = mode === "office" ? -84 : -72;
    }
    const sphere = new C.BoundingSphere(C.Cartesian3.fromDegrees(lon, lat), 1);
    const offset = new C.HeadingPitchRange(0, C.Math.toRadians(pitch), range);
    const cam = widget.camera;
    cam.cancelFlight();
    if (first || reducedMotion) { cam.viewBoundingSphere(sphere, offset); cam.lookAtTransform(C.Matrix4.IDENTITY); }
    else cam.flyToBoundingSphere(sphere, { offset, duration: 1.3, easingFunction: C.EasingFunction.QUADRATIC_IN_OUT });
    widget.scene.requestRender();
  }

  useEffect(() => { apply(); }, [mode, view]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { apply(false, false); }, [hot, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      <div ref={credits} className="es-credits" />
    </div>
  );
}
