export type AppPalette = {
  id: string;
  name: string;
  start: string;
  end: string;
};
export const PALETTE_KEY = "tripflow:palette";
export const PALETTES: AppPalette[] = [
  {
    id: "default",
    name: "TripFlow · Mặc định",
    start: "#084E59",
    end: "#15909A",
  },
  { id: "ocean", name: "Đại dương", start: "#154879", end: "#267DC0" },
  { id: "violet", name: "Tím hoàng hôn", start: "#493080", end: "#8B55B8" },
  { id: "rose", name: "Hồng san hô", start: "#842B54", end: "#C35373" },
  { id: "forest", name: "Rừng xanh", start: "#205B43", end: "#39866B" },
  { id: "amber", name: "Nắng ấm", start: "#79431D", end: "#A66B20" },
];
export function normalizeHex(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : null;
}
export function resolvePalette(value: unknown): AppPalette {
  if (!value || typeof value !== "object") return PALETTES[0];
  const p = value as Partial<AppPalette>;
  const preset = PALETTES.find((item) => item.id === p.id);
  if (preset) return preset;
  const start = normalizeHex(p.start),
    end = normalizeHex(p.end);
  return p.id === "custom" && start && end
    ? { id: "custom", name: "Tùy chỉnh", start, end }
    : PALETTES[0];
}
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const values = channels.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
export function mixHex(hex: string, target: number, amount: number): string {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(hex.slice(i, i + 2), 16) * (1 - amount) + target * amount,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
      .toUpperCase()
  );
}
// Keep white labels readable across the entire gradient, including very bright custom colors.
export function gradientStop(hex: string): string {
  let color = hex;
  for (let i = 0; i < 100 && luminance(color) > 0.13; i++)
    color = mixHex(color, 0, 0.025);
  return color;
}
export function paletteValues(palette: AppPalette): Record<string, string> {
  const start = gradientStop(palette.start),
    end = gradientStop(palette.end);
  let light = end,
    dark = end;
  for (let i = 0; i < 100 && luminance(light) > 0.11; i++)
    light = mixHex(light, 0, 0.035);
  for (let i = 0; i < 100 && luminance(dark) < 0.58; i++)
    dark = mixHex(dark, 255, 0.05);
  return {
    "--palette-start": start,
    "--palette-end": end,
    "--palette-light": light,
    "--palette-dark": dark,
  };
}
export function applyPalette(value: unknown) {
  const palette = resolvePalette(value),
    root = document.documentElement;
  if (palette.id === "default") {
    delete root.dataset.palette;
    for (const key of Object.keys(paletteValues(palette)))
      root.style.removeProperty(key);
  } else {
    root.dataset.palette = palette.id;
    for (const [key, color] of Object.entries(paletteValues(palette)))
      root.style.setProperty(key, color);
  }
  return palette;
}
// Plain JavaScript prevents bundlers/transpilers from adding closure-bound helper references.
export const PALETTE_BOOTSTRAP = `(()=>{try{
const presets=${JSON.stringify(PALETTES)};
const p=JSON.parse(localStorage.getItem(${JSON.stringify(PALETTE_KEY)})||'null');
const preset=presets.find(item=>item.id===p?.id);
const valid=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const selected=preset||(p?.id==='custom'&&valid(p.start)&&valid(p.end)?p:null);
if(!selected||selected.id==='default')return;
const lum=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const mix=(hex,target,amount)=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-amount)+target*amount).toString(16).padStart(2,'0')).join('').toUpperCase();
const stop=hex=>{let v=hex.toUpperCase();for(let i=0;i<100&&lum(v)>.13;i++)v=mix(v,0,.025);return v;};
const start=stop(selected.start),end=stop(selected.end);let light=end,dark=end;
for(let i=0;i<100&&lum(light)>.11;i++)light=mix(light,0,.035);
for(let i=0;i<100&&lum(dark)<.58;i++)dark=mix(dark,255,.05);
const root=document.documentElement;root.dataset.palette=selected.id;
for(const [name,color] of Object.entries({'--palette-start':start,'--palette-end':end,'--palette-light':light,'--palette-dark':dark}))root.style.setProperty(name,color);
}catch{}})();`;
