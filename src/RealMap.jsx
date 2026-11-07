import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 각 읍·면 좌표는 화면 이동을 위한 시연용 중심점입니다.
// 표시하는 격자와 위험도는 실제 농지 데이터나 행정구역 경계를 나타내지 않습니다.
const AREAS = {
  '전체': { center: [35.507, 129.193], zoom: 10 },
  '삼남읍': { center: [35.557, 129.117], zoom: 13 },
  '온양읍': { center: [35.420, 129.281], zoom: 13 },
  '범서읍': { center: [35.570, 129.234], zoom: 13 },
  '언양읍': { center: [35.579, 129.140], zoom: 13 },
  '온산읍': { center: [35.448, 129.326], zoom: 13 },
  '청량읍': { center: [35.495, 129.280], zoom: 13 },
  '웅촌면': { center: [35.460, 129.211], zoom: 13 },
  '서생면': { center: [35.350, 129.320], zoom: 13 },
  '상북면': { center: [35.607, 129.078], zoom: 13 },
  '두동면': { center: [35.667, 129.205], zoom: 13 },
  '두서면': { center: [35.654, 129.099], zoom: 13 },
  '삼동면': { center: [35.517, 129.170], zoom: 13 },
};

// 정확한 행정구역 폴리곤이나 분석용 격자 데이터가 없는 상태이므로
// 이 사각 범위는 그저 데모용 시각화 범위입니다 (실제 울주군 경계 아님).
const DEMO_EXTENT = {south: 35.315, north: 35.705, west: 129.01, east: 129.375};
const RISK_VALUE = {high: 0.99, medium: 0.57, low: 0.13};
// 사용자가 제시한 '지역 블록형' 히트맵과 유사한 이산 색 구간.
const COLOR_STOPS = [
  [0.23, 'rgba(31, 77, 180, .59)'],
  [0.32, 'rgba(56, 123, 209, .56)'],
  [0.42, 'rgba(116, 179, 219, .48)'],
  [0.50, 'rgba(196, 221, 221, .38)'],
  [0.57, 'rgba(244, 222, 168, .45)'],
  [0.65, 'rgba(246, 165, 124, .55)'],
  [0.75, 'rgba(232, 109, 92, .65)'],
  [1.01, 'rgba(183, 46, 56, .70)'],
];

function MapMove({ region, selected }) {
  const map = useMap();
  useEffect(() => {
    const target = selected
      ? {center: [selected.lat, selected.lng], zoom: 14}
      : (AREAS[region] || AREAS['전체']);
    map.flyTo(target.center, target.zoom, {animate: true, duration: 0.7});
  }, [map, region, selected]);
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cellShade(lat, lng, row, col, parcels) {
  // 가상 중심점의 위험도 값을 거리 가중 평균하여 보기 좋은 격자형 색상으로만 표현합니다.
  // 공간통계, AI 예측, 성토 위법 확률이 아닙니다.
  let weightedRisk = 0;
  let totalWeight = 0;
  let nearestKm = Infinity;
  for (const parcel of parcels) {
    const dy = (parcel.lat - lat) * 111.1;
    const dx = (parcel.lng - lng) * 90.8;
    const distanceSq = dx * dx + dy * dy;
    nearestKm = Math.min(nearestKm, Math.sqrt(distanceSq));
    if (distanceSq > 18 * 18) continue;
    const weight = Math.exp(-distanceSq / (2 * 4.7 * 4.7));
    weightedRisk += (RISK_VALUE[parcel.riskKey] ?? 0.55) * weight;
    totalWeight += weight;
  }
  if (totalWeight < 0.001 || nearestKm > 8.7) return null;
  // 지도가 표처럼 똑같은 사각형으로 반복되지 않도록 작은 고정 변주 적용.
  const mosaicNoise = Math.sin(row * 91.23 + col * 47.61) * Math.cos(row * 12.37 - col * 32.11);
  const value = clamp(weightedRisk / totalWeight + mosaicNoise * 0.052, 0, 1);
  const color = COLOR_STOPS.find(([max]) => value < max)?.[1] || COLOR_STOPS.at(-1)[1];
  // 경계에서 자연스럽게 끊기지만 둥근 반경 그래픽으로 보이지 않도록 일부 격자는 낮은 투명도로 유지.
  const opacity = nearestKm > 6.5 ? 0.6 : nearestKm > 5.5 ? 0.78 : 1;
  return {color, opacity};
}

/**
 * 지도 위에 '면 단위 격자 색상'을 그리는 캔버스입니다.
 * - 화면이 확대되면 격자 크기가 지리좌표에 맞춰 분할됩니다.
 * - 색상은 30개 가상 시연 후보로 계산한 보간 예시입니다.
 * - 지도 타일은 실제 배경지도이지만 격자는 실제 행정 통계가 아닙니다.
 */
function GridHeatmapCanvas({parcels}) {
  const map = useMap();

  useEffect(() => {
    let pane = map.getPane('demoGridHeatPane');
    if (!pane) {
      pane = map.createPane('demoGridHeatPane');
      pane.style.zIndex = '390';
      pane.style.pointerEvents = 'none';
    }
    const canvas = L.DomUtil.create('canvas', 'gis-hotspot-canvas', pane);
    canvas.style.pointerEvents = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    let raf = 0;
    const cache = new Map();

    function draw() {
      const size = map.getSize();
      if (!size.x || !size.y) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(size.x * dpr);
      const height = Math.round(size.y * dpr);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      const zoom = map.getZoom();
      const stepLat = 0.012 * 2 ** (10 - zoom);
      const stepLng = 0.014 * 2 ** (10 - zoom);
      const bounds = map.getBounds();
      const yMin = Math.ceil(Math.max(bounds.getSouth(), DEMO_EXTENT.south) / stepLat) - 1;
      const yMax = Math.floor(Math.min(bounds.getNorth(), DEMO_EXTENT.north) / stepLat) + 1;
      const xMin = Math.ceil(Math.max(bounds.getWest(), DEMO_EXTENT.west) / stepLng) - 1;
      const xMax = Math.floor(Math.min(bounds.getEast(), DEMO_EXTENT.east) / stepLng) + 1;

      // 확대해도 화면에 보이는 셀만 계산하므로 전체 지도를 무겁게 만들지 않습니다.
      for (let row = yMin; row <= yMax; row += 1) {
        for (let col = xMin; col <= xMax; col += 1) {
          const south = row * stepLat;
          const north = south + stepLat;
          const west = col * stepLng;
          const east = west + stepLng;
          const lat = (south + north) / 2;
          const lng = (west + east) / 2;
          if (lat < DEMO_EXTENT.south || lat > DEMO_EXTENT.north || lng < DEMO_EXTENT.west || lng > DEMO_EXTENT.east) continue;
          const cacheKey = `${zoom}:${row}:${col}`;
          let shade;
          if (cache.has(cacheKey)) shade = cache.get(cacheKey);
          else {
            shade = cellShade(lat, lng, row, col, parcels);
            cache.set(cacheKey, shade);
          }
          if (!shade) continue;
          const nw = map.latLngToContainerPoint([north, west]);
          const se = map.latLngToContainerPoint([south, east]);
          const left = Math.floor(nw.x);
          const top = Math.floor(nw.y);
          const rectWidth = Math.ceil(se.x) - left;
          const rectHeight = Math.ceil(se.y) - top;
          if (rectWidth < 1 || rectHeight < 1) continue;
          ctx.globalAlpha = shade.opacity;
          ctx.fillStyle = shade.color;
          ctx.fillRect(left, top, rectWidth, rectHeight);
        }
      }
      ctx.globalAlpha = 1;
    }

    function requestDraw() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        draw();
      });
    }
    map.on('move zoom resize', requestDraw);
    requestDraw();
    return () => {
      map.off('move zoom resize', requestDraw);
      if (raf) window.cancelAnimationFrame(raf);
      L.DomUtil.remove(canvas);
    };
  }, [map, parcels]);
  return null;
}

/** 격자 클릭 시 주변에서 가장 가까운 가상 후보를 선택합니다. */
function GridInteraction({parcels, onSelect}) {
  const map = useMap();
  useEffect(() => {
    const tooltip = L.tooltip({direction: 'top', opacity: 0.97});
    const container = map.getContainer();
    const previousCursor = container.style.cursor;
    let shownId = null;

    function nearestAt(latlng) {
      const pointer = map.latLngToContainerPoint(latlng);
      let nearest = null;
      let min = Infinity;
      for (const p of parcels) {
        const pos = map.latLngToContainerPoint([p.lat, p.lng]);
        const delta = pos.distanceTo(pointer);
        if (delta < min) {
          min = delta;
          nearest = p;
        }
      }
      return min < 78 ? nearest : null;
    }

    function handleClick(evt) {
      const parcel = nearestAt(evt.latlng);
      if (parcel) onSelect(parcel.id);
    }
    function handleMouseMove(evt) {
      const parcel = nearestAt(evt.latlng);
      container.style.cursor = parcel ? 'pointer' : previousCursor;
      if (!parcel) {
        shownId = null;
        map.removeLayer(tooltip);
        return;
      }
      if (shownId !== parcel.id) {
        shownId = parcel.id;
        tooltip.setLatLng([parcel.lat, parcel.lng]);
        tooltip.setContent(`${parcel.region} ${parcel.name} · 가상 후보 (클릭)`);
        tooltip.addTo(map);
      }
    }
    function clear() {
      shownId = null;
      map.removeLayer(tooltip);
      container.style.cursor = previousCursor;
    }

    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', clear);
    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', clear);
      clear();
    };
  }, [map, parcels, onSelect]);
  return null;
}

/**
 * 화면 픽셀 좌표를 이용해 30개 가상 지점을 축척별로 묶습니다.
 * 원 안의 숫자는 그룹에 속한 실제 가상 지점 개수이며, 위험 확률이 아닙니다.
 * 마커 클러스터는 지도 확대에 따라 자동으로 나뉩니다.
 */
function groupByScreenDistance(parcels, map, zoom) {
  const threshold = zoom <= 10 ? 58 : zoom === 11 ? 60 : zoom === 12 ? 54 : zoom === 13 ? 48 : 38;
  const groups = [];
  for (const parcel of parcels) {
    const point = map.project([parcel.lat, parcel.lng], zoom);
    let closest = null;
    let smallest = threshold;
    for (const group of groups) {
      const distance = point.distanceTo(group.point);
      if (distance < smallest) { smallest = distance; closest = group; }
    }
    if (closest) {
      const n = closest.parcels.length;
      closest.parcels.push(parcel);
      closest.point = L.point((closest.point.x * n + point.x) / (n + 1), (closest.point.y * n + point.y) / (n + 1));
      closest.lat = (closest.lat * n + parcel.lat) / (n + 1);
      closest.lng = (closest.lng * n + parcel.lng) / (n + 1);
    } else {
      groups.push({parcels: [parcel], point, lat: parcel.lat, lng: parcel.lng});
    }
  }
  return groups;
}

function clusterDivIcon(group) {
  const count = group.parcels.length;
  const high = group.parcels.filter(p => p.riskKey === 'high').length / count * 100;
  const mid = group.parcels.filter(p => p.riskKey === 'medium').length / count * 100;
  const boundary = high + mid;
  const ring = `conic-gradient(#f07770 0% ${high}%, #df77d3 ${high}% ${boundary}%, #5dbcc8 ${boundary}% 100%)`;
  const featured = group.parcels.some(p => p.featured);
  const diameter = count >= 6 ? 90 : count >= 4 ? 82 : count >= 2 ? 75 : 64;
  return L.divIcon({
    className: 'cluster-icon-shell',
    html: `<div class="cluster-bubble${featured ? ' contains-featured' : ''}" style="--cluster-size:${diameter}px;--cluster-ring:${ring}"><span class="cluster-bubble-inner"><b>${count}</b><small>${count === 1 ? '후보' : '건'}</small></span>${featured ? '<span class="cluster-featured-star" aria-hidden="true">★</span>' : ''}</div>`,
    iconSize: [diameter, diameter],
    iconAnchor: [diameter / 2, diameter / 2],
    tooltipAnchor: [0, -diameter / 2],
  });
}

/** 원형 클러스터: 묶음 클릭 시 확대, 개별 원 클릭 시 해당 사례 선택 */
function ClusterBubbles({parcels, onSelect}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const syncZoom = () => setZoom(map.getZoom());
    map.on('zoomend', syncZoom);
    return () => map.off('zoomend', syncZoom);
  }, [map]);
  const groups = useMemo(() => groupByScreenDistance(parcels, map, zoom), [parcels, map, zoom]);
  function handleCluster(group) {
    if (group.parcels.length === 1) { onSelect(group.parcels[0].id); return; }
    const bounds = L.latLngBounds(group.parcels.map(p => [p.lat, p.lng]));
    // 겹침이 매우 가까운 두 지점도 다음 축척에서 구분되도록 최소 2단계 확대.
    const next = Math.min(17, Math.max(map.getZoom() + 2, map.getBoundsZoom(bounds.pad(1.2))));
    map.flyTo([group.lat, group.lng], next, {animate: true, duration: 0.65});
  }
  return <>
    {groups.map(group => {
      const id = group.parcels.map(p => p.id).join('-');
      const featured = group.parcels.some(p => p.featured);
      return <Marker
        key={id}
        position={[group.lat, group.lng]}
        icon={clusterDivIcon(group)}
        bubblingMouseEvents={false}
        eventHandlers={{click: () => handleCluster(group)}}
      >
        <Tooltip direction="top" opacity={0.97}>
          {group.parcels.length}개 가상 후보 · {group.parcels.length > 1 ? '클릭해서 확대' : '클릭해서 요약 보기'}
          {featured ? ' · ★ 상세 시연 포함' : ''}
        </Tooltip>
      </Marker>;
    })}
  </>;
}

function createMarker(parcel, selected) {
  return L.divIcon({
    className: 'custom-marker-outer',
    html: `<div class="gis-marker ${parcel.riskKey}${selected ? ' active' : ''}"><span class="gis-marker-core"></span></div>`,
    iconSize: [35, 43],
    iconAnchor: [17, 39],
    tooltipAnchor: [0, -34],
  });
}

export default function RealMap({parcels, selected, region, onSelect, baseLayer, apiKey, mapMode = 'heat'}) {
  const keyAvailable = Boolean(apiKey);
  const satellite = baseLayer === 'satellite' && keyAvailable;
  const tileUrl = satellite
    ? `https://api.vworld.kr/req/wmts/1.0.0/${apiKey}/Satellite/{z}/{y}/{x}.jpeg`
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = satellite
    ? 'Map imagery © VWorld'
    : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>';
  const markers = useMemo(
    () => parcels.map(parcel => ({parcel, icon: createMarker(parcel, selected?.id === parcel.id)})),
    [parcels, selected],
  );
  const featured = useMemo(() => parcels.filter(p => p.featured), [parcels]);
  const featuredIcon = useMemo(() => L.divIcon({
    className: 'featured-marker-shell',
    html: '<div class="featured-map-tag"><span>★</span> 상세 시연</div>',
    iconSize: [94, 30],
    iconAnchor: [47, 15],
  }), []);

  return (
    <MapContainer center={AREAS['전체'].center} zoom={10} className="gis-map" zoomControl scrollWheelZoom preferCanvas>
      <TileLayer key={satellite ? 'satellite' : 'osm'} url={tileUrl} attribution={attribution} maxZoom={19}/>
      <MapMove region={region} selected={selected}/>
      {mapMode === 'cluster' ? <>
        <ClusterBubbles parcels={parcels} onSelect={onSelect}/>
        {selected && <CircleMarker center={[selected.lat, selected.lng]} radius={8} pathOptions={{color: '#fff', weight: 3, fillColor: '#266687', fillOpacity: 0.95}} interactive={false}/>}
      </> : mapMode === 'heat' ? <>
        <GridHeatmapCanvas parcels={parcels}/>
        <GridInteraction parcels={parcels} onSelect={onSelect}/>
        {featured.map(parcel => (
          <Marker
            key={`featured-${parcel.id}`}
            position={[parcel.lat, parcel.lng]}
            icon={featuredIcon}
            bubblingMouseEvents={false}
            eventHandlers={{click: () => onSelect(parcel.id)}}
          >
            <Tooltip direction="top" opacity={0.96}>{parcel.region} {parcel.name} · 대표 상세 시연</Tooltip>
          </Marker>
        ))}
        {selected && <>
          <CircleMarker center={[selected.lat, selected.lng]} radius={20} pathOptions={{color: '#fff', weight: 3, fillOpacity: 0, dashArray: '5 5'}} interactive={false}/>
          <CircleMarker center={[selected.lat, selected.lng]} radius={6} pathOptions={{color: '#fff', weight: 2, fillColor: '#cb3348', fillOpacity: 0.95}} interactive={false}/>
        </>}
      </> : markers.map(({parcel, icon}) => (
        <Marker key={parcel.id} position={[parcel.lat, parcel.lng]} icon={icon} eventHandlers={{click: () => onSelect(parcel.id)}}>
          <Tooltip direction="top" opacity={0.96}>{parcel.region} {parcel.name} · 가상 후보</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
