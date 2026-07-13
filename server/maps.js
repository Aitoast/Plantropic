// server/maps.js — 지도 API 래퍼 (AI 없음). 키는 서버 .env 에만.
//   KAKAO_REST_API_KEY : 장소명 → 좌표(지오코딩). 최소 요건.
//   ODSAY_API_KEY      : 대중교통 소요시간(정확). 없으면 좌표 직선거리로 근사.
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const ODSAY_KEY = process.env.ODSAY_API_KEY;

export const mapsConfigured = !!KAKAO_KEY;  // 지오코딩이 되어야 최소 동작

// 장소명 → { lat, lng, name }  (카카오 키워드 검색)
export async function geocode(query) {
  if (!KAKAO_KEY || !query) return null;
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const d = data.documents?.[0];
  return d ? { lat: parseFloat(d.y), lng: parseFloat(d.x), name: d.place_name } : null;
}

// 두 좌표 직선거리(km)
export function haversineKm(a, b) {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// 대중교통 소요(분). ODsay 있으면 실측, 없으면 직선거리 기반 근사.
export async function transitMinutes(from, to) {
  if (ODSAY_KEY) {
    try {
      const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${from.lng}&SY=${from.lat}&EX=${to.lng}&EY=${to.lat}&apiKey=${encodeURIComponent(ODSAY_KEY)}`;
      const res = await fetch(url);
      const data = await res.json();
      const t = data?.result?.path?.[0]?.info?.totalTime;
      if (t) return { minutes: Math.round(t), source: "odsay" };
    } catch { /* 실패 시 근사로 폴백 */ }
  }
  const km = haversineKm(from, to);
  const minutes = Math.round((km / 22) * 60) + 5; // 도심 대중교통 평균 ~22km/h + 대기 5분
  return { minutes, source: "estimate" };
}

// 출발 권장 시각 = 일정시작 - (이동 + 준비)
export function computeLeaveBy(startsAtISO, travelMin, prepMin) {
  const total = travelMin + prepMin;
  const leaveBy = new Date(new Date(startsAtISO).getTime() - total * 60000);
  const hhmm = `${String(leaveBy.getHours()).padStart(2, "0")}:${String(leaveBy.getMinutes()).padStart(2, "0")}`;
  return { total, leaveBy, hhmm };
}
