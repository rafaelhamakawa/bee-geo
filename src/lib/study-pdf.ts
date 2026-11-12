import { LIABILITY_DISCLAIMER, CIRCLE_AREA_HA, fmtHa, fmtPct, type AnalysisTotals } from "@/lib/geoapis";
import type { MultiPoly } from "@/lib/vegetation-scan";

type Area = { name?: string | null; vegetation_type?: string | null; area_ha: number; percentage: number; geom?: MultiPoly | undefined; biome?: string | undefined };
type Near = { latitude: number; longitude: number };

type Project = (lng: number, lat: number) => [number, number];

const ESRI_TILE = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("timeout")), 15000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error("tile error")); };
    img.src = ESRI_TILE(z, x, y);
  });
}

// Baixa os tiles de satélite que cobrem o círculo de 1,5 km e devolve a imagem
// montada + função de projeção (lng,lat) -> pixels do canvas.
async function fetchSatelliteMap(
  lat: number,
  lng: number,
  radiusM: number,
): Promise<{ dataUrl: string; size: number; project: (lng: number, lat: number) => [number, number] } | null> {
  try {
    const z = 16;
    const n = 2 ** z;
    const pxX = (lg: number) => ((lg + 180) / 360) * n * 256;
    const pxY = (lt: number) => {
      const r = (lt * Math.PI) / 180;
      return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n * 256;
    };
    const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / n; // metros por pixel
    const half = radiusM / mpp;
    const size = Math.ceil(half * 2);
    if (size > 2048) return null;
    const cx = pxX(lng), cy = pxY(lat);
    const ox = cx - half, oy = cy - half;
    const x0 = Math.floor(ox / 256), x1 = Math.floor((ox + size) / 256);
    const y0 = Math.floor(oy / 256), y1 = Math.floor((oy + size) / 256);
    const jobs: Promise<void>[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        jobs.push(
          loadTile(z, tx, ty).then((img) => {
            ctx.drawImage(img, Math.round(tx * 256 - ox), Math.round(ty * 256 - oy));
          }),
        );
      }
    }
    await Promise.all(jobs);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.9),
      size,
      project: (lg, lt) => [pxX(lg) - ox, pxY(lt) - oy],
    };
  } catch {
    return null;
  }
}

export async function exportStudyPdf(o: {
  name: string; lat: number; lng: number; biome: string; totals: AnalysisTotals; areas: Area[]; nearby: Near[]; loc?: { municipio: string; uf: string; regiao: string } | null;
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const G = [30, 90, 50] as const, DARK = [30, 30, 30] as const, MUTED = [90, 90, 90] as const;
  const FIELD = [226, 234, 244] as const, PALE = [233, 240, 230] as const;
  const txt = (t: string, x: number, y: number, size: number, bold = false, c: readonly number[] = DARK, align: "left" | "right" | "center" = "left") => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0]!, c[1]!, c[2]!);
    doc.text(t, x, y, { align });
  };
  const hr = (y: number) => { doc.setDrawColor(200); doc.setLineWidth(0.3); doc.line(15, y, 195, y); };

  // Cabeçalho
  txt("MODELO DE RELATÓRIO", 15, 16, 8, true, G);
  txt("Estudo de pasto apícola", 15, 27, 24, true);
  txt("Mapeamento de áreas com potencial de oferta de recursos para as abelhas.", 15, 34, 9, false, MUTED);
  hr(38);

  // Mapa
  const mx = 15, my = 46, mw = 108, mh = 100;
  txt("Mapa do entorno", mx, 44, 11, true);
  txt(`${o.areas.length} ÁREAS DETECTADAS`, mx + mw, 44, 6.5, true, G, "right");

  const cx = mx + mw / 2, cy = my + mh / 2, R = 42; // R mm = 1500 m
  const sat = await fetchSatelliteMap(o.lat, o.lng, 1500);

  let P: Project;
  if (sat) {
    // Imagem de satélite real como fundo, cobrindo exatamente o círculo de 1,5 km.
    doc.addImage(sat.dataUrl, "JPEG", mx, my, mw, mh);
    P = (lng, lat) => {
      const [px, py] = sat.project(lng, lat);
      return [mx + (px / sat.size) * mw, my + (py / sat.size) * mh];
    };
  } else {
    // Fallback esquemático (sem conexão com o serviço de imagens).
    doc.setFillColor(243, 236, 214); doc.rect(mx, my, mw, mh, "F");
    const k = R / 1500, mLat = 110574, mLng = 111320 * Math.cos((o.lat * Math.PI) / 180);
    P = (lng, lat) => [cx + (lng - o.lng) * mLng * k, cy - (lat - o.lat) * mLat * k];
    doc.setFillColor(250, 246, 232); doc.circle(cx, cy, R, "F");
  }

  // Áreas delimitadas por cima do fundo (translúcidas quando há satélite).
  const gstate = (opacity: number) => new (doc as any).GState({ opacity });
  if (sat) doc.setGState(gstate(0.45));
  o.areas.forEach((a, i) => {
    if (!a.geom) return;
    doc.setFillColor(110, 170, 110); doc.setDrawColor(40, 100, 50); doc.setLineWidth(0.3);
    let sx = 0, sy = 0, n = 0;
    for (const poly of a.geom) for (const ring of poly) {
      const pts = ring.map(([x, y]) => P(x, y));
      if (pts.length < 3) continue;
      const segs = pts.slice(1).map((p, j) => [p[0] - pts[j]![0], p[1] - pts[j]![1]]);
      doc.lines(segs, pts[0]![0], pts[0]![1], [1, 1], "FD", true);
      pts.forEach((p) => { sx += p[0]; sy += p[1]; n++; });
    }
    if (n) {
      const lx = sx / n, ly = sy / n, lab = `P${String(i + 1).padStart(2, "0")}`;
      doc.setFillColor(255, 255, 255); doc.roundedRect(lx - 4, ly - 2.4, 8, 3.8, 0.6, 0.6, "F");
      txt(lab, lx, ly + 0.6, 6, true, DARK, "center");
    }
  });
  if (sat) doc.setGState(new doc.GState({ opacity: 1 }));

  doc.saveGraphicsState(); doc.rect(mx, my, mw, mh, null); doc.clip(); doc.discardPath();
  o.nearby.forEach((a) => {
    const [x, y] = P(a.longitude, a.latitude);
    if (Math.hypot(x - cx, y - cy) < 1) return;
    doc.setDrawColor(200, 60, 60); doc.setLineDashPattern([1.5, 1], 0); doc.setLineWidth(0.4); doc.circle(x, y, R, "S");
  });
  doc.restoreGraphicsState(); doc.setLineDashPattern([], 0);
  doc.setDrawColor(20); doc.setLineWidth(0.6); doc.circle(cx, cy, R, "S");
  doc.setLineDashPattern([1.2, 1], 0); doc.setLineWidth(0.4); doc.line(cx, cy, cx + R, cy); doc.setLineDashPattern([], 0);
  doc.setFillColor(255, 255, 255); doc.rect(cx + R / 2 - 6, cy - 5, 12, 3.6, "F");
  txt("1,5 km", cx + R / 2, cy - 2.2, 6.5, true, DARK, "center");
  doc.setFillColor(190, 50, 40); doc.circle(cx, cy, 1.4, "F");
  // Norte e escala
  txt("N", mx + mw - 6, my + 6, 8, true, DARK, "center");
  doc.setFillColor(30, 30, 30); doc.triangle(mx + mw - 6, my + 7.5, mx + mw - 8, my + 12, mx + mw - 4, my + 12, "F");
  doc.setFillColor(255, 255, 255); doc.rect(mx + 3, my + mh - 11, 34, 8, "F");
  doc.setFillColor(30, 30, 30); doc.rect(mx + 5, my + mh - 6, 14, 1.2, "F"); doc.setDrawColor(30); doc.rect(mx + 19, my + mh - 6, 14, 1.2, "S");
  txt("0", mx + 5, my + mh - 7.2, 5); txt("0,5", mx + 19, my + mh - 7.2, 5, false, DARK, "center"); txt("1 km", mx + 33, my + mh - 7.2, 5, false, DARK, "center");
  // Legenda
  const ly = my + mh + 5;
  doc.setFillColor(190, 50, 40); doc.circle(mx + 1.5, ly - 1, 1.2, "F"); txt("Ponto do apiário", mx + 4, ly, 7, false, MUTED);
  doc.setFillColor(110, 170, 110); doc.rect(mx + 33, ly - 2.4, 4, 2.8, "F"); txt("Pasto potencial", mx + 39, ly, 7, false, MUTED);
  doc.setDrawColor(20); doc.setLineWidth(0.5); doc.line(mx + 68, ly - 1, mx + 74, ly - 1); txt("Limite do raio", mx + 76, ly, 7, false, MUTED);

  // Dados do ponto
  const dx = 132, dw = 63;
  txt("Dados do ponto", dx, 44, 11, true);
  const field = (label: string, value: string, x: number, y: number, w: number) => {
    txt(label, x, y, 7, true); doc.setFillColor(FIELD[0], FIELD[1], FIELD[2]); doc.rect(x, y + 1.5, w, 5, "F");
    if (value) txt(value, x + 1.5, y + 5, 7.5);
  };
  let fy = 51;
  field("Propriedade ou área", o.name, dx, fy, dw); fy += 10;
  field("Município / UF", o.loc ? `${o.loc.municipio} / ${o.loc.uf}` : "", dx, fy, dw); fy += 10;
  field("Região do Brasil", o.loc?.regiao ?? "", dx, fy, dw); fy += 10;
  field("Bioma(s)", [...new Set([o.biome, ...o.areas.map((a) => a.biome)].filter(Boolean))].join(", "), dx, fy, dw); fy += 10;
  field("Latitude (°)", o.lat.toFixed(6), dx, fy, 30); field("Longitude (°)", o.lng.toFixed(6), dx + 33, fy, 30); fy += 10;
  field("Datum / SRC", "WGS 84 (EPSG:4326)", dx, fy, dw); fy += 10;
  field("Fonte e data da imagem", `Satélite · ${new Date().toLocaleDateString("pt-BR")}`, dx, fy, dw); fy += 11;
  doc.setFillColor(PALE[0], PALE[1], PALE[2]); doc.setDrawColor(200); doc.roundedRect(dx, fy, dw, 36, 2, 2, "FD");
  txt("Área total do círculo", dx + 4, fy + 5, 7, false, G);
  txt(`${fmtHa(CIRCLE_AREA_HA)} ha`, dx + 4, fy + 12, 15, true);
  doc.line(dx + 4, fy + 15, dx + dw - 4, fy + 15);
  txt("Pasto potencial", dx + 4, fy + 20, 7, false, G);
  txt(`${fmtHa(o.totals.total_forage_area_ha)} ha`, dx + 4, fy + 27, 14, true, G);
  txt(`${fmtPct(o.totals.total_forage_percentage)} do círculo · ${o.totals.safe_hives} colmeias seguras`, dx + 4, fy + 32, 6.5, false, MUTED);

  // Tabela
  let y = 162;
  txt("Áreas delimitadas", 15, y, 13, true);
  txt(`Capacidade bruta ${o.totals.total_gross_hives.toFixed(1)} · segura (×0,85) ${o.totals.safe_hives} colmeias`, 195, y, 7, false, MUTED, "right");
  y += 4;
  const cols = [17, 33, 100, 128, 140];
  const head = () => {
    doc.setFillColor(PALE[0], PALE[1], PALE[2]); doc.rect(15, y, 180, 6, "F");
    txt("ID", cols[0]!, y + 4, 7, true); txt("Cobertura indicativa", cols[1]!, y + 4, 7, true);
    txt("Área (ha)", 112, y + 4, 7, true, DARK, "right"); txt("% do círculo", 135, y + 4, 7, true, DARK, "right");
    txt("Verificação em campo", cols[4]!, y + 4, 7, true); y += 6;
  };
  head();
  o.areas.forEach((a, i) => {
    if (y > 270) { doc.addPage(); y = 20; head(); }
    txt(`P${String(i + 1).padStart(2, "0")}`, cols[0]!, y + 4, 7, true, G);
    txt(doc.splitTextToSize(`${a.name ?? a.vegetation_type ?? ""}`, 64)[0], cols[1]!, y + 4, 7);
    txt(fmtHa(a.area_ha), 112, y + 4, 7, false, DARK, "right");
    txt(fmtPct(a.percentage), 135, y + 4, 7, false, DARK, "right");
    txt("Identificar espécies e épocas de floração", cols[4]!, y + 4, 6.5);
    doc.setDrawColor(225); doc.line(15, y + 6, 195, y + 6); y += 6;
  });
  doc.setFillColor(PALE[0], PALE[1], PALE[2]); doc.rect(15, y, 180, 6, "F");
  txt("Total de pasto potencial", cols[0]!, y + 4, 7, true);
  txt(fmtHa(o.totals.total_forage_area_ha), 112, y + 4, 7, true, DARK, "right");
  txt(fmtPct(o.totals.total_forage_percentage), 135, y + 4, 7, true, DARK, "right");
  txt("Soma das áreas delimitadas", cols[4]!, y + 4, 6.5, false, MUTED);
  y += 14;

  if (y > 235) { doc.addPage(); y = 20; }
  txt("Validação de campo", 15, y, 13, true); y += 6;
  const vf = (l: string, x: number) => { txt(l, x, y, 7, true); doc.setFillColor(FIELD[0], FIELD[1], FIELD[2]); doc.rect(x, y + 2, 87, 5, "F"); };
  vf("Plantas visitadas e recursos (néctar, pólen ou resina)", 15); vf("Meses de floração e períodos de escassez", 108); y += 11;
  vf("Água, acesso e apiários vizinhos", 15); vf("Risco de pulverização e data da vistoria", 108);
  if (o.nearby.length) txt(`${o.nearby.length} apiário(s) vizinho(s) com raio sobreposto`, 16.5, y + 5.6, 6.5, false, [180, 40, 40]);
  y += 13; hr(y); y += 6;
  txt("Como aplicar", 15, y, 7, true, G);
  txt("Gere o mapa em um SIG com a imagem georreferenciada e o círculo de 1.500 m.", 38, y, 7, false, MUTED);
  txt("Recorte os polígonos ao círculo, elimine sobreposições e recalcule as áreas e os percentuais.", 38, y + 4, 7, false, MUTED);
  y += 10; hr(y); y += 6;
  txt("Fontes para consulta", 15, y, 7, true, G);
  txt("IBGE · Biomas     IBGE · Grandes Regiões     MapBiomas · Uso da terra     Embrapa · Flora apícola", 45, y, 7, false, MUTED);
  y += 8; if (y > 275) { doc.addPage(); y = 20; }
  doc.setFillColor(250, 238, 230); doc.roundedRect(15, y, 180, 14, 1.5, 1.5, "F");
  txt("Aviso de responsabilidade", 18, y + 4.5, 7, true, [160, 50, 30]);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(60, 60, 60);
  doc.text(doc.splitTextToSize(LIABILITY_DISCLAIMER, 172), 18, y + 8);
  doc.save(`estudo-pasto-${Date.now()}.pdf`);
}
